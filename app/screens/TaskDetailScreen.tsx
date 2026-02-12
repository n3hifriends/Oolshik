import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, ActivityIndicator, Pressable, Linking, Platform, Alert, Modal } from "react-native"
import { useFocusEffect, useRoute } from "@react-navigation/native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { TextField } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"
import { useTaskStore } from "@/store/taskStore"
import { OolshikApi } from "@/api"
import { FLAGS } from "@/config/flags"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { SmileySlider } from "@/components/SmileySlider"
import { RatingBadge } from "@/components/RatingBadge"
import { Task } from "@/api/client"
import { useAuth } from "@/context/AuthContext"
import { useAudioPlaybackForUri } from "@/audio/audioPlayback"
import {
  submitFeedback,
  hasSubmittedFeedback,
  markSubmittedFeedback,
} from "@/features/feedback/storage/feedbackQueue"

type RouteParams = { id: string }
type RecoveryAction = "cancel" | "release" | "reject"

const REASSIGN_SLA_SECONDS = 420
const MAX_REASSIGN = 2

function getInitials(name?: string) {
  if (!name) return "👤"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

function minsAgo(iso?: string) {
  if (!iso) return ""
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const mins = Math.max(0, Math.round(diffMs / 60000))

  if (mins < 1) return "just now"
  if (mins === 1) return "1 min ago"
  if (mins < 60) return `${mins} mins ago`
  const hrs = Math.round(mins / 60)
  if (hrs === 1) return "1 hr ago"
  if (hrs < 24) return `${hrs} hrs ago`

  // For older than a day, show readable date
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function maskPhoneNumber(input?: string) {
  if (!input) return ""
  // keep non-digits as-is, mask all digits except the last 4
  const digits = input.replace(/\D/g, "")
  if (digits.length <= 4) return input
  const last4 = digits.slice(-4)
  let remainingToMask = Math.max(0, digits.length - 4)
  let lastIdx = 0
  let out = ""
  for (const ch of input) {
    if (/\d/.test(ch)) {
      if (remainingToMask > 0) {
        out += "*"
        remainingToMask -= 1
      } else {
        out += last4[lastIdx++] ?? ch
      }
    } else {
      out += ch
    }
  }
  return out
}

export default function TaskDetailScreen({ navigation }: any) {
  const { params } = useRoute<any>() as { params: RouteParams }
  const taskId = params?.id

  const { theme } = useAppTheme()
  const { spacing, colors } = theme

  const { tasks, accept, fetchNearby, upsertTask } = useTaskStore()
  const { userId } = useAuth()
  const taskFromStore = tasks.find((t) => String(t.id) === String(taskId))

  const [loading, setLoading] = React.useState(!taskFromStore)
  const [task, setTask] = React.useState(taskFromStore || null)

  const current = task || taskFromStore || null

  const {
    status: playbackStatus,
    toggle,
    stop,
  } = useAudioPlaybackForUri(
    current?.voiceUrl ? String(current.voiceUrl) : null,
    current?.id ? `detail-${current.id}` : "detail",
  )
  const { coords, status, error: locationError, refresh } = useForegroundLocation()
  const [actionLoading, setActionLoading] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const [ratingSubmitting, setRatingSubmitting] = React.useState(false)
  const [recoveryNotice, setRecoveryNotice] = React.useState<string | null>(null)
  const [authDecision, setAuthDecision] = React.useState<"approved" | "rejected" | null>(null)
  const authExpiredRef = useRef(false)
  const [csatRating, setCsatRating] = useState(4)
  const [csatTag, setCsatTag] = useState<string | null>(null)
  const [csatSubmitting, setCsatSubmitting] = useState(false)
  const [csatSubmitted, setCsatSubmitted] = useState(false)

  const [fullPhone, setFullPhone] = React.useState<string | null>(null)
  const [isRevealed, setIsRevealed] = React.useState(false)
  const [revealLoading, setRevealLoading] = React.useState(false)

  const [reasonModal, setReasonModal] = React.useState<{
    visible: boolean
    action?: RecoveryAction
    reasonCode?: string
    reasonText?: string
  }>({ visible: false })

  const primary = colors.palette.primary500
  const primarySoft = colors.palette.primary200
  const success = "#16A34A"
  const successSoft = "#BBF7D0"
  const warning = "#D97706"
  const warningSoft = "#FDE68A"
  const neutral600 = colors.palette.neutral600
  const neutral700 = colors.palette.neutral700

  const statusMap = {
    PENDING: { label: "Pending", bg: primarySoft, fg: primary },
    PENDING_AUTH: { label: "Awaiting approval", bg: colors.palette.primary100, fg: primary },
    ASSIGNED: { label: "Assigned", bg: warningSoft, fg: warning },
    COMPLETED: { label: "Completed", bg: successSoft, fg: success },
    CANCELLED: { label: "Cancelled", bg: colors.palette.neutral200, fg: neutral700 },
  } as const

  const [rating, setRating] = useState<number>(2.5) // center default (neutral)

  useFocusEffect(
    useCallback(() => {
      refresh()
      return () => {
        void stop()
      }
    }, [refresh, stop]),
  )

  // Normalize backend statuses (e.g., OPEN/CANCELLED) to UI statuses used in statusMap
  let normalizedStatus: "PENDING" | "PENDING_AUTH" | "ASSIGNED" | "COMPLETED" | "CANCELLED" =
    "PENDING"
  const rawStatus = (current?.status as string | undefined) || undefined
  switch (rawStatus) {
    case "OPEN":
      normalizedStatus = "PENDING"
      break
    case "PENDING_AUTH":
      normalizedStatus = "PENDING_AUTH"
      break
    case "CANCELLED":
    case "CANCELED":
      normalizedStatus = "CANCELLED"
      break
    case "PENDING":
    case "ASSIGNED":
    case "COMPLETED":
      normalizedStatus = rawStatus as any
      break
    default:
      normalizedStatus = "PENDING"
  }

  useEffect(() => {
    if (rawStatus !== "PENDING_AUTH") {
      setAuthDecision(null)
    }
  }, [rawStatus])

  useEffect(() => {
    if (!current?.id) {
      setCsatSubmitted(false)
      return
    }
    const key = `task:${current.id}:csat`
    setCsatSubmitted(hasSubmittedFeedback(key))
  }, [current?.id])

  // ensure we have the task (e.g., deep link / app resume)
  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(!taskFromStore)
      try {
        const res = await OolshikApi.findTaskByTaskId(taskId)
        const fetchedTask = res?.ok ? (res.data as Task | null) : null
        if (!cancelled && fetchedTask) setTask(fetchedTask)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  const refreshTask = async () => {
    if (!taskId || refreshing) return
    setRefreshing(true)
    try {
      const res = await OolshikApi.findTaskByTaskId(taskId)
      if (res?.ok && res.data) {
        setTask(res.data as Task)
        upsertTask(res.data as Task)
        return
      }
      const msg = (res as any)?.data?.message || "Unable to refresh task details."
      Alert.alert("Refresh failed", msg)
    } finally {
      setRefreshing(false)
    }
  }

  const S = statusMap[normalizedStatus] ?? statusMap.PENDING

  const isRequester = !!current?.requesterId && !!userId && current.requesterId === userId

  const isHelper = !!current?.helperId && !!userId && current.helperId === userId
  const isPendingHelper =
    !!current?.pendingHelperId && !!userId && current.pendingHelperId === userId
  const contactLabel = isRequester ? "Helper phone" : "Requester phone"
  const hasHelper = !!current?.helperId || !!current?.pendingHelperId
  const canViewContact = isRequester
    ? !!rawStatus && rawStatus !== "OPEN" && hasHelper
    : !!fullPhone

  React.useEffect(() => {
    const requesterPhone =
      current?.requesterPhoneNumber ||
      current?.createdByPhoneNumber ||
      (current as any)?.phoneNumber
    const helperPhone = current?.helperPhoneNumber || (current as any)?.helperPhone

    const nextPhone = isRequester ? helperPhone : requesterPhone
    setFullPhone(nextPhone ? String(nextPhone) : null)
    setIsRevealed(false) // always start masked on open
  }, [
    current?.requesterPhoneNumber,
    current?.createdByPhoneNumber,
    (current as any)?.phoneNumber,
    (current as any)?.helperPhone,
    current?.helperPhoneNumber,
    isRequester,
  ])
  const ratingByRequester = current?.ratingByRequester ?? null
  const ratingByHelper = current?.ratingByHelper ?? null
  const myRating = isRequester ? ratingByRequester : isHelper ? ratingByHelper : null
  const otherPartyRating = isRequester ? ratingByHelper : isHelper ? ratingByRequester : null
  const oppositeAvgRating = isRequester ? current?.helperAvgRating : current?.requesterAvgRating
  const canCancel =
    isRequester &&
    (rawStatus === "OPEN" || rawStatus === "ASSIGNED" || rawStatus === "PENDING_AUTH")
  const canRelease = isHelper && rawStatus === "ASSIGNED"

  const helperAcceptedAtMs = current?.helperAcceptedAt
    ? new Date(current.helperAcceptedAt).getTime()
    : null
  const pendingAuthExpiresAtMs = current?.pendingAuthExpiresAt
    ? new Date(current.pendingAuthExpiresAt).getTime()
    : null
  const reassignAvailableAtMs = helperAcceptedAtMs
    ? helperAcceptedAtMs + REASSIGN_SLA_SECONDS * 1000
    : null
  const [nowMs, setNowMs] = React.useState(Date.now())
  const msUntilAuthExpiry = pendingAuthExpiresAtMs
    ? Math.max(0, pendingAuthExpiresAtMs - nowMs)
    : null

  useEffect(() => {
    const needsReassignTimer = reassignAvailableAtMs && rawStatus === "ASSIGNED"
    const needsAuthTimer = pendingAuthExpiresAtMs && rawStatus === "PENDING_AUTH"
    if (!needsReassignTimer && !needsAuthTimer) return
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [rawStatus, reassignAvailableAtMs, pendingAuthExpiresAtMs])

  useEffect(() => {
    if (!recoveryNotice) return
    const timer = setTimeout(() => setRecoveryNotice(null), 4000)
    return () => clearTimeout(timer)
  }, [recoveryNotice])

  useEffect(() => {
    if (rawStatus !== "PENDING_AUTH") {
      authExpiredRef.current = false
      return
    }
    if (msUntilAuthExpiry == null || msUntilAuthExpiry > 0) {
      authExpiredRef.current = false
      return
    }
    if (authExpiredRef.current) return
    authExpiredRef.current = true
    setRecoveryNotice("Authorization expired; searching again.")

    const refreshTask = async () => {
      try {
        const res = await OolshikApi.findTaskByTaskId(taskId)
        if (res?.ok) {
          setTask(res.data as Task)
        }
        if (coords && status === "ready") {
          await fetchNearby(coords.latitude, coords.longitude)
        }
      } catch {
        // best-effort refresh
      }
    }
    refreshTask()
  }, [coords, fetchNearby, msUntilAuthExpiry, rawStatus, status, taskId])

  const msUntilReassign = reassignAvailableAtMs ? Math.max(0, reassignAvailableAtMs - nowMs) : null
  const authExpired = msUntilAuthExpiry !== null && msUntilAuthExpiry <= 0
  const canReassign =
    isRequester &&
    rawStatus === "ASSIGNED" &&
    msUntilReassign === 0 &&
    (current?.reassignedCount ?? 0) < MAX_REASSIGN

  const reassignCountdown = useMemo(() => {
    if (msUntilReassign == null) return null
    const totalSeconds = Math.ceil(msUntilReassign / 1000)
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0")
    const secs = String(totalSeconds % 60).padStart(2, "0")
    return `${mins}:${secs}`
  }, [msUntilReassign])

  const authCountdown = useMemo(() => {
    if (msUntilAuthExpiry == null) return null
    const totalSeconds = Math.ceil(msUntilAuthExpiry / 1000)
    const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0")
    const secs = String(totalSeconds % 60).padStart(2, "0")
    return `${mins}:${secs}`
  }, [msUntilAuthExpiry])

  const onRevealPhone = async () => {
    if (!current) return
    try {
      setRevealLoading(true)
      setIsRevealed(true)

      // Calls backend to log & return full number
      const res = await OolshikApi.revealPhone(current.id as any)
      if (res?.ok) {
        const num = res.data?.phoneNumber ?? fullPhone
        // const num = (res.data as { phoneNumber?: string })?.phoneNumber ?? fullPhone
        if (num) setFullPhone(String(num))
        setIsRevealed(true)
      } else {
        const msg = res?.data?.message || "Unable to show number"
        alert(msg)
      }
    } finally {
      setRevealLoading(false)
    }
  }

  const onCall = () => {
    const num = (fullPhone || "").replace(/[^+\d]/g, "")
    if (num) Linking.openURL(`tel:${num}`)
  }

  const audioLoading = playbackStatus === "loading"
  const playing = playbackStatus === "playing"
  const togglePlay = () => toggle()

  const onAccept = async () => {
    if (status !== "ready" || !coords) {
      refresh()
      Alert.alert("Location not available", "Please enable location and try again.")
      return
    }
    if (!current) return
    if (isRequester) {
      Alert.alert("You created this request", "Only nearby helpers can accept it.")
      return
    }
    const result = await accept(current.id, coords.latitude, coords.longitude)
    if (result === "ALREADY") {
      alert("Already assigned")
    } else if (result === "OK") {
      alert("Authorization requested")
      setTask((t: any) =>
        t
          ? {
              ...t,
              status: "PENDING_AUTH",
              pendingAuthExpiresAt: new Date(Date.now() + 120 * 1000).toISOString(),
            }
          : t,
      )
      try {
        const res = await OolshikApi.findTaskByTaskId(current.id as any)
        if (res?.ok) {
          setTask(res.data as Task)
        }
      } catch {
        // best-effort refresh
      }
    } else {
      alert("Error accepting task / Requester can't accept this task")
    }
    // reflect status locally
  }

  const onAuthorize = async () => {
    if (!current || actionLoading) return
    setActionLoading(true)
    setRecoveryNotice("Authorizing...")
    try {
      const res = await OolshikApi.authorizeRequest(current.id as any)
      if (res?.ok) {
        setAuthDecision("approved")
        if (res?.data) {
          setTask((t: any) =>
            t
              ? {
                  ...t,
                  ...(res.data as any),
                  status: "ASSIGNED",
                  pendingAuthExpiresAt: null,
                }
              : { ...(res.data as any), status: "ASSIGNED", pendingAuthExpiresAt: null },
          )
        } else {
          setTask((t: any) => (t ? { ...t, status: "ASSIGNED", pendingAuthExpiresAt: null } : t))
        }
        setRecoveryNotice("Authorization approved.")
        if (coords && status === "ready") {
          await fetchNearby(coords.latitude, coords.longitude)
        }
        return
      }
      if (res?.status === 409) {
        const refreshed = await OolshikApi.findTaskByTaskId(current.id as any)
        if (refreshed?.ok && refreshed?.data) {
          setTask(refreshed.data as Task)
          const refreshedStatus = (refreshed.data as any)?.status
          if (refreshedStatus === "ASSIGNED") {
            setRecoveryNotice("Authorization already approved.")
            return
          }
          if (refreshedStatus === "OPEN") {
            setRecoveryNotice("Authorization expired; searching again.")
            return
          }
        }
        setRecoveryNotice("Authorization not allowed.")
        return
      }
      throw new Error("Authorize failed")
    } catch {
      setAuthDecision(null)
      Alert.alert("Approve failed", "Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  async function openInMaps(lat: number, lon: number, label = "Task") {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      Alert.alert("Location unavailable", "Coordinates are missing.")
      return
    }

    const safeLabel = encodeURIComponent(label)
    const appleMaps = `https://maps.apple.com/?ll=${lat},${lon}&q=${safeLabel}`
    const googleWeb = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}&q=(${safeLabel})`
    const geo = `geo:${lat},${lon}?q=${lat},${lon}(${safeLabel})`

    try {
      if (Platform.OS === "android") {
        if (await Linking.canOpenURL(geo)) {
          await Linking.openURL(geo)
          return
        }
      }

      const primary = Platform.OS === "ios" ? appleMaps : googleWeb
      if (await Linking.canOpenURL(primary)) {
        await Linking.openURL(primary)
        return
      }

      if (await Linking.canOpenURL(googleWeb)) {
        await Linking.openURL(googleWeb)
        return
      }
    } catch {
      // fall through to alert
    }

    Alert.alert("No Maps App Found", `Can't open maps on this device.\n\n${lat}, ${lon}`)
  }

  const onComplete = async () => {
    if (!current) return
    const res = await OolshikApi.completeTask(current.id as any)
    if (res?.ok) {
      setTask((t: any) => (t ? { ...t, status: "COMPLETED" } : t))
      // stay on screen so requester can rate helper
    } else if (
      res?.status === 403 ||
      res?.status === 409 ||
      String(res?.data || "").includes("Only requester can complete")
    ) {
      alert("Only the requester can complete this task")
    } else {
      alert("Error completing task")
    }
  }

  const onSubmitRating = async () => {
    if (!current) return
    if (!isRequester && !isHelper) return
    if (myRating != null) return
    setRatingSubmitting(true)
    try {
      const res = await OolshikApi.rateTask(current.id as any, {
        rating,
        feedback: undefined,
      })
      if (!res?.ok) {
        throw new Error("Rating failed")
      }
      setTask((t: any) =>
        t
          ? {
              ...t,
              ratingByRequester: isRequester ? rating : t.ratingByRequester,
              ratingByHelper: isHelper ? rating : t.ratingByHelper,
            }
          : t,
      )
      setRecoveryNotice("Rating submitted. Thank you!")
    } catch (e) {
      Alert.alert("Rating failed", "Please try again.")
    } finally {
      setRatingSubmitting(false)
    }
  }

  const onSubmitCsat = async () => {
    if (!current?.id || csatSubmitting || csatSubmitted) return
    setCsatSubmitting(true)
    const key = `task:${current.id}:csat`
    const cleanRating = Math.max(1, Math.min(5, Math.round(csatRating)))
    const res = await submitFeedback({
      feedbackType: "CSAT",
      contextType: "TASK",
      contextId: String(current.id),
      rating: cleanRating,
      tags: csatTag ? [csatTag] : undefined,
    })
    setCsatSubmitting(false)

    if (res.ok || res.queued) {
      markSubmittedFeedback(key)
      setCsatSubmitted(true)
      setRecoveryNotice("Thanks for the feedback.")
      return
    }

    Alert.alert("Feedback failed", "Please try again.")
  }

  const ratingBadgeValue = normalizedStatus === "COMPLETED" ? otherPartyRating : oppositeAvgRating
  const showRatingBadge = ratingBadgeValue != null
  const canRate = normalizedStatus === "COMPLETED" && (isRequester || isHelper)
  const distance =
    (current?.distanceMtr ?? 0) < 1000
      ? `${(current?.distanceMtr ?? 0).toFixed(0)}m`
      : `${((current?.distanceMtr ?? 0) / 1000).toFixed(1)}km`

  const renderLocationState = () => {
    if (status === "loading" || status === "idle") {
      return (
        <View style={{ paddingVertical: 16, alignItems: "center", gap: 8 }}>
          <ActivityIndicator />
          <Text text="Getting your location…" />
        </View>
      )
    }
    if (status === "denied") {
      return (
        <View style={{ paddingVertical: 16, gap: 10 }}>
          <Text preset="heading" text="Location permission denied" />
          <Text text="Enable location to accept tasks." />
          <Button text="Open Settings" onPress={() => Linking.openSettings()} />
        </View>
      )
    }
    if (status === "error") {
      return (
        <View style={{ paddingVertical: 16, gap: 10 }}>
          <Text preset="heading" text="Could not access location" />
          <Text text={locationError ?? "Please try again."} />
          <Button text="Retry" onPress={refresh} />
        </View>
      )
    }
    return null
  }

  const openReasonSheet = (action: RecoveryAction) => {
    setReasonModal({
      visible: true,
      action,
      reasonCode: undefined,
      reasonText: "",
    })
  }

  const closeReasonSheet = () => {
    setReasonModal({ visible: false })
  }

  const onConfirmReason = async () => {
    if (!current || !reasonModal.action || !reasonModal.reasonCode) return
    if (reasonModal.reasonCode === "OTHER" && !reasonModal.reasonText?.trim()) {
      Alert.alert("Add a short reason", "Please add a short note for 'Other'.")
      return
    }
    setActionLoading(true)
    try {
      if (reasonModal.action === "cancel") {
        const res = await OolshikApi.cancelTask(current.id, {
          reasonCode: reasonModal.reasonCode,
          reasonText: reasonModal.reasonText?.trim() || undefined,
        })
        if (!res?.ok) {
          throw new Error("Cancel failed")
        }
        setTask((t: any) => (t ? { ...t, status: "CANCELLED" } : t))
        setRecoveryNotice("Request cancelled. We’ve closed it and notified the helper if assigned.")
      } else if (reasonModal.action === "release") {
        const res = await OolshikApi.releaseTask(current.id, {
          reasonCode: reasonModal.reasonCode,
          reasonText: reasonModal.reasonText?.trim() || undefined,
        })
        if (!res?.ok) {
          throw new Error("Release failed")
        }
        setTask((t: any) => (t ? { ...t, status: "OPEN", helperId: null } : t))
        setRecoveryNotice("Task released. It’s now open for other helpers to accept.")
      } else if (reasonModal.action === "reject") {
        const res = await OolshikApi.rejectRequest(current.id, {
          reasonCode: reasonModal.reasonCode,
          reasonText: reasonModal.reasonText?.trim() || undefined,
        })
        if (!res?.ok) {
          throw new Error("Reject failed")
        }
        if (res?.data) {
          setTask(res.data as any)
        } else {
          setTask((t: any) => (t ? { ...t, status: "OPEN", pendingHelperId: null } : t))
        }
        setRecoveryNotice("Authorization rejected. Searching again.")
      }

      if (coords && status === "ready") {
        await fetchNearby(coords.latitude, coords.longitude)
      }
      closeReasonSheet()
    } catch (e) {
      Alert.alert("Action failed", "Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  const onReassign = async () => {
    if (!current) return
    setActionLoading(true)
    try {
      const res = await OolshikApi.reassignTask(current.id)
      if (!res?.ok) {
        throw new Error("Reassign failed")
      }
      setTask((t: any) => (t ? { ...t, status: "OPEN", helperId: null } : t))
      setRecoveryNotice("Request reopened. We'll look for another helper now.")
      if (coords && status === "ready") {
        await fetchNearby(coords.latitude, coords.longitude)
      }
    } catch (e) {
      Alert.alert("Reassign failed", "Please try again.")
    } finally {
      setActionLoading(false)
    }
  }

  const cancelReasons = useMemo(
    () => [
      { code: "NOT_NEEDED", label: "No longer needed" },
      { code: "FOUND_ALTERNATIVE", label: "Found another helper" },
      { code: "WRONG_TASK", label: "Created by mistake" },
      { code: "OTHER", label: "Other" },
    ],
    [],
  )

  const releaseReasons = useMemo(
    () => [
      { code: "CANT_COMPLETE", label: "Cannot complete" },
      { code: "EMERGENCY", label: "Emergency" },
      { code: "OTHER", label: "Other" },
    ],
    [],
  )

  const rejectReasons = useMemo(
    () => [
      { code: "NOT_COMFORTABLE", label: "Not comfortable" },
      { code: "FOUND_OTHER_HELP", label: "Found other help" },
      { code: "WAIT_TOO_LONG", label: "Waited too long" },
      { code: "OTHER", label: "Other" },
    ],
    [],
  )

  const currentReasons =
    reasonModal.action === "release"
      ? releaseReasons
      : reasonModal.action === "reject"
        ? rejectReasons
        : cancelReasons

  return (
    <Screen preset="scroll" safeAreaEdges={["top", "bottom"]}>
      {/* Header (fixed) */}
      <View style={{ padding: 16, flexDirection: "row", alignItems: "center" }}>
        <Text preset="heading" text="Task Detail" />
        {/* REPORT *** lightweight header action */}
        <View
          style={{
            marginLeft: "auto",
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
          }}
        >
          <Pressable
            onPress={refreshTask}
            disabled={refreshing}
            accessibilityRole="button"
            accessibilityLabel="Refresh task details"
            style={({ pressed }) => ({
              minHeight: 32,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xxxs,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: colors.palette.neutral300,
              backgroundColor: colors.palette.neutral100,
              opacity: refreshing ? 0.6 : 1,
              transform: [{ scale: pressed ? 0.98 : 1 }],
              alignItems: "center",
              justifyContent: "center",
              minHeight: 32,
            })}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.palette.primary500} />
            ) : (
              <Text text="Refresh" size="xs" weight="medium" style={{ color: colors.textDim }} />
            )}
          </Pressable>
          <Button
            text="Report"
            onPress={() => {
              navigation.navigate("OolshikReport", { taskId: current?.id })
            }}
            style={{
              minHeight: 32,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xxxs,
              borderRadius: 999,
            }}
            textStyle={{ fontSize: 12, lineHeight: 16 }}
          />
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 32 }}>
        {loading || !current ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {loading ? <ActivityIndicator /> : <Text text="Task not found" />}
          </View>
        ) : status !== "ready" ? (
          renderLocationState()
        ) : (
          <View style={{ gap: spacing.md }}>
            {/* Poster row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#E5E7EB",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text text={getInitials(current.createdByName)} weight="bold" />
              </View>
              <View style={{ flex: 1 }}>
                <Text text={current.createdByName || "Someone nearby"} weight="medium" />
                <Text text={minsAgo(current.createdAt)} size="xs" style={{ color: neutral600 }} />
              </View>

              {/* Small play control on the right */}
              {!!current.voiceUrl && (
                <Pressable
                  onPress={togglePlay}
                  accessibilityRole="button"
                  accessibilityLabel={
                    audioLoading ? "Loading voice" : playing ? "Stop voice" : "Play voice"
                  }
                  accessibilityState={{ disabled: audioLoading }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: primary,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: audioLoading ? 0.7 : 1,
                  }}
                >
                  <Text
                    text={audioLoading ? "…" : playing ? "⏸" : "▶︎"}
                    style={{ color: "white", fontWeight: "bold" }}
                  />
                </Pressable>
              )}
            </View>

            {/* Title / description */}
            <View style={{ gap: spacing.xs }}>
              <Text
                text={current.description || "Voice task"}
                weight="bold"
                style={{ color: neutral700 }}
              />
            </View>

            {/* Contact (masked -> reveal) */}
            {canViewContact && (
              <View
                style={{
                  gap: spacing.xs,
                  padding: spacing.sm,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.palette.neutral300,
                  backgroundColor: colors.palette.neutral100,
                }}
              >
                <Text text={contactLabel} weight="medium" style={{ color: neutral700 }} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Text
                    text={
                      isRevealed && fullPhone
                        ? String(fullPhone)
                        : maskPhoneNumber(fullPhone || "•••••••••••••")
                    }
                    weight="bold"
                    style={{ flex: 1, color: neutral700 }}
                  />
                  {isRevealed ? (
                    <Button
                      text="Call"
                      onPress={onCall}
                      disabled={!fullPhone}
                      style={{ paddingVertical: spacing.xs }}
                    />
                  ) : (
                    <Button
                      text={revealLoading ? "…" : "Show"}
                      onPress={onRevealPhone}
                      style={{ paddingVertical: spacing.xs }}
                    />
                  )}
                </View>
              </View>
            )}

            {/* Compact single-line row; wraps only if absolutely necessary */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.xxs,
                justifyContent: "space-between",
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xxs,
                  flexShrink: 1,
                  minWidth: 0,
                }}
              >
                {typeof current.distanceMtr === "number" ? (
                  <View
                    style={{
                      paddingHorizontal: spacing.xs,
                      paddingVertical: spacing.xxxs,
                      borderRadius: 999,
                      backgroundColor: colors.palette.neutral200,
                      flexShrink: 1,
                      minWidth: 0,
                    }}
                  >
                    <Text
                      text={`${distance} away`}
                      size="xs"
                      numberOfLines={1}
                      style={{ color: neutral700 }}
                    />
                  </View>
                ) : (
                  <View />
                )}

                <Pressable
                  onPress={() => openInMaps(current.latitude || 0, current.longitude || 0)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.xxs,
                    paddingHorizontal: spacing.xs,
                    paddingVertical: spacing.xxxs,
                    borderRadius: 999,
                    backgroundColor: colors.palette.primary100,
                    borderWidth: 1,
                    borderColor: colors.palette.primary200,
                    maxWidth: 96,
                    flexShrink: 1,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Open maps for directions"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <View
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 8,
                      backgroundColor: primary,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text text="↗" size="xxs" weight="bold" style={{ color: "white" }} />
                  </View>
                  <Text
                    text="Map"
                    size="xs"
                    weight="medium"
                    numberOfLines={1}
                    style={{ color: primary, flexShrink: 1 }}
                  />
                </Pressable>
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.xxs,
                  flexShrink: 0,
                }}
              >
                <View
                  style={{
                    paddingHorizontal: spacing.xs,
                    paddingVertical: spacing.xxxs,
                    borderRadius: 999,
                    backgroundColor: S.bg,
                  }}
                >
                  <Text text={S.label} size="xs" weight="medium" style={{ color: S.fg }} />
                </View>
                {showRatingBadge && <RatingBadge value={ratingBadgeValue} />}
              </View>
            </View>
          </View>
        )}
      </View>
      <View style={{ height: 12 }} />

      {/* Bottom actions / success banner */}
      {current && (
        <>
          {recoveryNotice && (
            <View
              style={{
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                marginHorizontal: 16,
                marginBottom: spacing.xs,
                borderRadius: 8,
                backgroundColor: successSoft,
                borderWidth: 1,
                borderColor: success,
              }}
            >
              <Text text={recoveryNotice} weight="medium" style={{ color: success }} />
            </View>
          )}
          {rawStatus === "PENDING_AUTH" && !authDecision ? (
            <View style={{ marginHorizontal: 16, gap: spacing.sm }}>
              {isRequester ? (
                <View
                  style={{
                    gap: spacing.xs,
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.sm,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.palette.neutral300,
                    backgroundColor: colors.palette.neutral100,
                  }}
                >
                  <Text text="Helper requested authorization." weight="medium" />
                  <Text text={`Requester: ${current.createdByName || "Requester"}`} size="xs" />
                  {authCountdown && !authExpired && (
                    <Text text={`Approve within ${authCountdown}`} size="xs" />
                  )}
                  {authExpired && <Text text="Authorization expired." size="xs" />}
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Button
                      text={actionLoading ? "..." : "Approve"}
                      onPress={onAuthorize}
                      disabled={authExpired || actionLoading}
                      style={{ flex: 1, paddingVertical: spacing.xs }}
                    />
                    <Button
                      text="Reject"
                      onPress={() => openReasonSheet("reject")}
                      disabled={authExpired || actionLoading}
                      style={{ flex: 1, paddingVertical: spacing.xs }}
                    />
                  </View>
                </View>
              ) : isPendingHelper ? (
                <View
                  style={{
                    gap: spacing.xs,
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.sm,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.palette.neutral300,
                    backgroundColor: colors.palette.neutral100,
                  }}
                >
                  <Text text="Waiting for requester approval." weight="medium" />
                  <Text text={`Requester: ${current.createdByName || "Requester"}`} size="xs" />
                  {authCountdown && !authExpired && (
                    <Text text={`Time left: ${authCountdown}`} size="xs" />
                  )}
                  {authExpired && <Text text="Authorization expired." size="xs" />}
                </View>
              ) : (
                <View
                  style={{
                    gap: spacing.xs,
                    paddingVertical: spacing.xs,
                    paddingHorizontal: spacing.sm,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.palette.neutral300,
                    backgroundColor: colors.palette.neutral100,
                  }}
                >
                  <Text text="Awaiting requester approval." weight="medium" />
                </View>
              )}
            </View>
          ) : normalizedStatus === "PENDING" || normalizedStatus === "ASSIGNED" ? (
            <View
              style={{
                flexDirection: "row",
                marginHorizontal: 16,
                gap: spacing.sm,
              }}
            >
              {normalizedStatus === "PENDING" ? (
                isRequester ? (
                  <View
                    style={{
                      flex: 1,
                      paddingVertical: spacing.xs,
                      paddingHorizontal: spacing.sm,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.palette.neutral300,
                      backgroundColor: colors.palette.neutral100,
                    }}
                  >
                    <Text text="You created this request." weight="medium" />
                    <Text text="Waiting for a helper to accept." size="xs" />
                  </View>
                ) : (
                  <Button
                    text="Accept"
                    onPress={onAccept}
                    style={{ flex: 2, paddingVertical: spacing.xs }}
                  />
                )
              ) : (
                <View
                  style={{
                    gap: spacing.sm,
                    paddingHorizontal: spacing.sm,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.palette.neutral300,
                    backgroundColor: colors.palette.neutral100,
                    flex: 1,
                    paddingVertical: spacing.sm,
                  }}
                >
                  {isRequester ? (
                    <>
                      <Text text="You can mark this task as completed." weight="medium" />
                      <Button
                        text="Mark as Complete"
                        onPress={onComplete}
                        style={{ flex: 2, paddingVertical: spacing.xs }}
                      />
                    </>
                  ) : (
                    <Text text="Waiting for requester to complete." weight="medium" />
                  )}
                </View>
              )}
            </View>
          ) : null}
          {canRate ? (
            <View
              style={{
                gap: spacing.md,
                paddingHorizontal: spacing.sm,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.palette.neutral300,
                backgroundColor: colors.palette.neutral100,
                marginHorizontal: 16,
                paddingBottom: 16,
                paddingTop: 12,
              }}
            >
              {myRating == null && (
                <Text
                  text={isRequester ? "Rate your helper" : "Rate the requester"}
                  preset="subheading"
                />
              )}
              {myRating == null ? (
                <>
                  <SmileySlider disabled={false} value={rating} onChange={setRating} />
                  <Text style={{ textAlign: "center", marginTop: 6, opacity: 0.6 }}>
                    {rating.toFixed(1)} / 5.0
                  </Text>
                  <Button
                    text={ratingSubmitting ? "..." : "Submit Rating"}
                    onPress={onSubmitRating}
                    style={{ paddingVertical: spacing.xs }}
                    disabled={ratingSubmitting}
                  />
                </>
              ) : (
                <Text text={`You rated: ${myRating.toFixed(1)} / 5.0`} weight="medium" />
              )}
              {otherPartyRating != null && (
                <Text
                  text={`${
                    isRequester ? "Helper" : "Requester"
                  } rated you: ${otherPartyRating.toFixed(1)} / 5.0`}
                  size="xs"
                />
              )}
            </View>
          ) : null}
          {normalizedStatus === "COMPLETED" && current?.id ? (
            <View
              style={{
                gap: spacing.sm,
                paddingHorizontal: spacing.sm,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.palette.neutral300,
                backgroundColor: colors.palette.neutral100,
                marginHorizontal: 16,
                paddingBottom: 16,
                paddingTop: 12,
              }}
            >
              <Text text="How was the overall experience?" preset="subheading" />
              {csatSubmitted ? (
                <Text text="Thanks for the feedback." size="xs" style={{ color: neutral600 }} />
              ) : (
                <>
                  <View style={{ flexDirection: "row", gap: spacing.xs }}>
                    {[1, 2, 3, 4, 5].map((val) => {
                      const active = Math.round(csatRating) === val
                      return (
                        <Pressable
                          key={`csat-${val}`}
                          onPress={() => setCsatRating(val)}
                          accessibilityRole="button"
                          accessibilityLabel={`Rate ${val}`}
                          style={({ pressed }) => ({
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            alignItems: "center",
                            justifyContent: "center",
                            borderWidth: 1,
                            borderColor: active ? primary : colors.palette.neutral300,
                            backgroundColor: active ? colors.palette.primary100 : "transparent",
                            opacity: pressed ? 0.7 : 1,
                          })}
                        >
                          <Text text={String(val)} weight="medium" />
                        </Pressable>
                      )
                    })}
                  </View>
                  <View style={{ gap: spacing.xs }}>
                    <Text text="Quick tag (optional)" size="xs" style={{ color: neutral600 }} />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                      {[
                        "Smooth",
                        "Helpful",
                        "Clear communication",
                        "Could improve",
                      ].map((tag) => {
                        const active = csatTag === tag
                        return (
                          <Pressable
                            key={tag}
                            onPress={() => setCsatTag(active ? null : tag)}
                            style={({ pressed }) => ({
                              paddingHorizontal: spacing.sm,
                              paddingVertical: spacing.xxxs,
                              borderRadius: 999,
                              borderWidth: 1,
                              borderColor: active ? primary : colors.palette.neutral300,
                              backgroundColor: active ? colors.palette.primary100 : "transparent",
                              opacity: pressed ? 0.7 : 1,
                            })}
                            accessibilityRole="button"
                            accessibilityLabel={`Tag ${tag}`}
                          >
                            <Text text={tag} size="xs" style={{ color: active ? primary : neutral700 }} />
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>
                  <Button
                    text={csatSubmitting ? "..." : "Send feedback"}
                    onPress={onSubmitCsat}
                    disabled={csatSubmitting}
                    style={{ paddingVertical: spacing.xs }}
                  />
                </>
              )}
            </View>
          ) : null}
          {(canCancel || canRelease || rawStatus === "ASSIGNED") && (
            <View style={{ marginTop: spacing.md, marginHorizontal: 16, gap: spacing.xs }}>
              {canCancel && (
                <Button
                  text={actionLoading ? "..." : "Cancel Request"}
                  onPress={() => openReasonSheet("cancel")}
                  style={{ paddingVertical: spacing.xs }}
                />
              )}
              {canRelease && (
                <Button
                  text={actionLoading ? "..." : "Give Away"}
                  onPress={() => openReasonSheet("release")}
                  style={{ paddingVertical: spacing.xs }}
                />
              )}
              {isRequester && rawStatus === "ASSIGNED" && !canReassign && reassignCountdown && (
                <Text text={`Reassign available in ${reassignCountdown}`} size="xs" />
              )}
              {canReassign && (
                <Button
                  text={actionLoading ? "..." : "Reassign Helper"}
                  onPress={onReassign}
                  style={{ paddingVertical: spacing.xs }}
                />
              )}
              {isRequester &&
                rawStatus === "ASSIGNED" &&
                (current?.reassignedCount ?? 0) >= MAX_REASSIGN && (
                  <Text text="Reassign limit reached" size="xs" />
                )}
            </View>
          )}
          {normalizedStatus === "COMPLETED" && (
            <View
              style={{
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                marginVertical: spacing.sm,
                marginHorizontal: 16,
                borderRadius: 8,
                backgroundColor: successSoft,
                borderWidth: 1,
                borderColor: success,
              }}
            >
              <Text text="Task completed ✓" weight="bold" style={{ color: success }} />
              <Text style={{ marginBottom: 5 }} text="Thanks for helping!" size="xs" />
              <Button
                text="Ok"
                onPress={() => navigation.goBack()}
                style={{ flex: 2, paddingVertical: spacing.xs }}
              />
            </View>
          )}
        </>
      )}

      <Modal transparent visible={reasonModal.visible} animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.35)",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderRadius: 16,
              padding: 16,
              gap: spacing.sm,
            }}
          >
            <Text
              text={
                reasonModal.action === "release"
                  ? "Reason for giving away"
                  : reasonModal.action === "reject"
                    ? "Reason for reject"
                    : "Reason for cancel"
              }
              preset="subheading"
            />
            {currentReasons.map((r) => {
              const selected = reasonModal.reasonCode === r.code
              return (
                <Pressable
                  key={r.code}
                  onPress={() =>
                    setReasonModal((prev) => ({
                      ...prev,
                      reasonCode: r.code,
                    }))
                  }
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: selected ? primary : colors.palette.neutral300,
                    backgroundColor: selected
                      ? colors.palette.primary100
                      : colors.palette.neutral100,
                  }}
                >
                  <Text text={r.label} />
                </Pressable>
              )
            })}

            {reasonModal.reasonCode === "OTHER" && (
              <TextField
                value={reasonModal.reasonText}
                onChangeText={(v) =>
                  setReasonModal((prev) => ({
                    ...prev,
                    reasonText: v,
                  }))
                }
                placeholder="Add a short note"
                containerStyle={{ marginBottom: 0 }}
              />
            )}

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button text="Go Back" onPress={closeReasonSheet} style={{ flex: 1 }} />
              <Button
                text={actionLoading ? "..." : "Confirm"}
                onPress={onConfirmReason}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}
