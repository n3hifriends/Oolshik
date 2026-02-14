import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { View, ActivityIndicator, Pressable, Linking, Platform, Alert, Modal } from "react-native"
import { useFocusEffect, useRoute } from "@react-navigation/native"
import { useTranslation } from "react-i18next"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { TextField, TextFieldAccessoryProps } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"
import { useTaskStore } from "@/store/taskStore"
import { OolshikApi } from "@/api"
import { FLAGS } from "@/config/flags"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { SmileySlider } from "@/components/SmileySlider"
import { RatingBadge } from "@/components/RatingBadge"
import { PaymentRequestApiResponse, Task } from "@/api/client"
import { useAuth } from "@/context/AuthContext"
import { useAudioPlaybackForUri } from "@/audio/audioPlayback"
import {
  submitFeedback,
  hasSubmittedFeedback,
  markSubmittedFeedback,
  getSubmittedFeedbackSnapshot,
  saveSubmittedFeedbackSnapshot,
  type SubmittedFeedbackSnapshot,
} from "@/features/feedback/storage/feedbackQueue"
import { PaymentScanPayload, PaymentTaskContext } from "@/navigators/OolshikNavigator"
import { canEditOfferForTask, parseOfferInput } from "@/utils/offerRules"

type RouteParams = { id: string }
type RecoveryAction = "cancel" | "release" | "reject"

const REASSIGN_SLA_SECONDS = 420
const MAX_REASSIGN = 2

function getInitials(name?: string) {
  if (!name) return "👤"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

function minsAgo(iso: string | undefined, t: (key: string, options?: any) => string) {
  if (!iso) return ""
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const mins = Math.max(0, Math.round(diffMs / 60000))

  if (mins < 1) return t("oolshik:relativeTime.justNow")
  if (mins === 1) return t("oolshik:relativeTime.oneMinAgo")
  if (mins < 60) return t("oolshik:relativeTime.minsAgo", { count: mins })
  const hrs = Math.round(mins / 60)
  if (hrs === 1) return t("oolshik:relativeTime.oneHrAgo")
  if (hrs < 24) return t("oolshik:relativeTime.hrsAgo", { count: hrs })

  // For older than a day, show readable date
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function paymentExpiryText(
  iso: string | null | undefined,
  t: (key: string, options?: any) => string,
) {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const mins = Math.round(absMs / 60000)

  if (diffMs >= 0) {
    if (mins < 1) return t("payment:pay.expiry.expiresSoon")
    if (mins === 1) return t("payment:pay.expiry.expiresInOneMin")
    if (mins < 60) return t("payment:pay.expiry.expiresInMins", { count: mins })
    const hrs = Math.round(mins / 60)
    if (hrs === 1) return t("payment:pay.expiry.expiresInOneHr")
    if (hrs < 24) return t("payment:pay.expiry.expiresInHrs", { count: hrs })
    return t("payment:pay.expiry.expiresOn", { date: date.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) })
  }

  if (mins < 1) return t("payment:pay.expiry.expiredNow")
  if (mins === 1) return t("payment:pay.expiry.expiredOneMin")
  if (mins < 60) return t("payment:pay.expiry.expiredMins", { count: mins })
  const hrs = Math.round(mins / 60)
  if (hrs === 1) return t("payment:pay.expiry.expiredOneHr")
  if (hrs < 24) return t("payment:pay.expiry.expiredHrs", { count: hrs })
  return t("payment:pay.expiry.expiredOn", { date: date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }) })
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

function paymentStatusLabel(value: string | null | undefined, t: (key: string) => string) {
  const status = (value || "").toUpperCase()
  switch (status) {
    case "PENDING":
      return t("payment:pay.status.pending")
    case "INITIATED":
      return t("payment:pay.status.initiated")
    case "PAID_MARKED":
      return t("payment:pay.status.paidMarked")
    case "DISPUTED":
      return t("payment:pay.status.disputed")
    case "EXPIRED":
      return t("payment:pay.status.expired")
    default:
      return status || t("payment:pay.status.default")
  }
}

export default function TaskDetailScreen({ navigation }: any) {
  const { t } = useTranslation()
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
  const [submittedCsat, setSubmittedCsat] = useState<SubmittedFeedbackSnapshot | null>(null)

  const [fullPhone, setFullPhone] = React.useState<string | null>(null)
  const [isRevealed, setIsRevealed] = React.useState(false)
  const [revealLoading, setRevealLoading] = React.useState(false)

  const [reasonModal, setReasonModal] = React.useState<{
    visible: boolean
    action?: RecoveryAction
    reasonCode?: string
    reasonText?: string
  }>({ visible: false })
  const [activePayment, setActivePayment] = useState<PaymentRequestApiResponse | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [offerInput, setOfferInput] = useState("")
  const [offerSaving, setOfferSaving] = useState(false)
  const [offerNotice, setOfferNotice] = useState<string | null>(null)
  const [helperPaymentAmountInput, setHelperPaymentAmountInput] = useState("")
  const [helperPaymentAmountError, setHelperPaymentAmountError] = useState<string | null>(null)

  const primary = colors.palette.primary500
  const primarySoft = colors.palette.primary200
  const success = "#16A34A"
  const successSoft = "#BBF7D0"
  const warning = "#D97706"
  const warningSoft = "#FDE68A"
  const neutral600 = colors.palette.neutral600
  const neutral700 = colors.palette.neutral700

  const statusMap = {
    PENDING: { label: t("oolshik:status.pending"), bg: primarySoft, fg: primary },
    PENDING_AUTH: { label: t("oolshik:status.pendingAuth"), bg: colors.palette.primary100, fg: primary },
    ASSIGNED: { label: t("oolshik:status.assigned"), bg: warningSoft, fg: warning },
    COMPLETED: { label: t("oolshik:status.completed"), bg: successSoft, fg: success },
    CANCELLED: { label: t("oolshik:status.cancelled"), bg: colors.palette.neutral200, fg: neutral700 },
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
      setSubmittedCsat(null)
      return
    }
    const key = `task:${current.id}:csat`
    setCsatSubmitted(hasSubmittedFeedback(key))
    setSubmittedCsat(getSubmittedFeedbackSnapshot(key))
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
      const msg = (res as any)?.data?.message || t("errors:fallback")
      Alert.alert(t("task:create.alerts.createFailedTitle"), msg)
    } finally {
      setRefreshing(false)
    }
  }

  const S = statusMap[normalizedStatus] ?? statusMap.PENDING

  const isRequester = !!current?.requesterId && !!userId && current.requesterId === userId

  const isHelper = !!current?.helperId && !!userId && current.helperId === userId
  const loadActivePayment = useCallback(async () => {
    if (!taskId || (!isRequester && !isHelper)) {
      setActivePayment(null)
      return
    }
    setPaymentLoading(true)
    try {
      const res = await OolshikApi.getActivePaymentRequest(taskId)
      if (res?.ok && res.data) {
        setActivePayment(res.data)
        return
      }
      if (res?.status === 404) {
        setActivePayment(null)
        return
      }
      setActivePayment(null)
    } catch {
      setActivePayment(null)
    } finally {
      setPaymentLoading(false)
    }
  }, [taskId, isRequester, isHelper])

  const isPendingHelper =
    !!current?.pendingHelperId && !!userId && current.pendingHelperId === userId
  const contactLabel = isRequester
    ? t("oolshik:taskDetailScreen.contactHelperPhone")
    : t("oolshik:taskDetailScreen.contactRequesterPhone")
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
  const canEditOffer = canEditOfferForTask(isRequester, rawStatus, current?.helperId ?? null)
  const currentOfferAmount = typeof current?.offerAmount === "number" ? current.offerAmount : null
  const currentOfferText =
    currentOfferAmount == null
      ? t("oolshik:taskDetailScreen.noOffer")
      : `₹${currentOfferAmount.toFixed(2)} ${current?.offerCurrency || "INR"}`

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
    setRecoveryNotice(t("oolshik:taskDetailScreen.authorizationExpiredSearching"))

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

  useEffect(() => {
    if (currentOfferAmount == null) {
      setOfferInput("")
      return
    }
    setOfferInput(currentOfferAmount.toFixed(2))
  }, [current?.id, currentOfferAmount])

  useEffect(() => {
    if (!offerNotice) return
    const timer = setTimeout(() => setOfferNotice(null), 3000)
    return () => clearTimeout(timer)
  }, [offerNotice])

  useEffect(() => {
    if (!isHelper) return
    const amount = activePayment?.snapshot?.amountRequested
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return
    setHelperPaymentAmountInput((prev) => (prev.trim().length ? prev : amount.toFixed(2)))
  }, [isHelper, activePayment?.id, activePayment?.snapshot?.amountRequested])

  useEffect(() => {
    if (!current?.id) {
      setActivePayment(null)
      return
    }
    if (rawStatus === "CANCELLED" || rawStatus === "COMPLETED" || rawStatus === "OPEN") {
      setActivePayment(null)
      return
    }
    loadActivePayment()
  }, [current?.id, current?.updatedAt, rawStatus, loadActivePayment])

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
  const activePaymentStatus = (
    activePayment?.status ??
    activePayment?.snapshot?.status ??
    ""
  ).toUpperCase()
  const paymentAwaitingUser =
    activePaymentStatus === "PENDING" || activePaymentStatus === "INITIATED"
  const paymentCanAct = !!activePayment?.canPay && paymentAwaitingUser
  const paymentStatusText = paymentStatusLabel(activePaymentStatus, t)
  const paymentExpiresText = paymentExpiryText(activePayment?.snapshot?.expiresAt, t)
  const canOpenPaymentsScanner = isHelper && !!current?.id && rawStatus === "ASSIGNED"

  const sanitizePaymentAmountInput = useCallback((value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "")
    const firstDot = cleaned.indexOf(".")
    if (firstDot < 0) return cleaned
    const intPart = cleaned.slice(0, firstDot + 1)
    const fracPart = cleaned
      .slice(firstDot + 1)
      .replace(/\./g, "")
      .slice(0, 2)
    return `${intPart}${fracPart}`
  }, [])

  const PaymentAmountPrefix = useCallback(
    (props: TextFieldAccessoryProps) => (
      <View style={[props.style, { justifyContent: "center" }]}>
        <Text text="₹" weight="medium" style={{ color: neutral700 }} />
      </View>
    ),
    [neutral700],
  )

  const onSaveOffer = async () => {
    if (!current || !canEditOffer || offerSaving) return
    const parsedOffer = parseOfferInput(offerInput)
    if (!parsedOffer.ok) {
      Alert.alert(
        t("task:create.alerts.invalidOfferTitle"),
        parsedOffer.error || t("task:create.alerts.invalidOfferBody"),
      )
      return
    }
    const nextAmount = parsedOffer.amount

    setOfferSaving(true)
    try {
      const res = await OolshikApi.updateTaskOffer(String(current.id), {
        offerAmount: nextAmount,
        offerCurrency: "INR",
      })
      if (!res?.ok || !res.data) {
        const message = (res?.data as any)?.message || t("errors:fallback")
        Alert.alert(t("task:create.alerts.createFailedTitle"), message)
        return
      }
      const data = res.data as any
      setTask((prev: any) =>
        prev
          ? {
              ...prev,
              offerAmount: typeof data.offerAmount === "number" ? data.offerAmount : nextAmount,
              offerCurrency: data.offerCurrency ?? "INR",
              offerUpdatedAt: data.offerUpdatedAt ?? new Date().toISOString(),
            }
          : prev,
      )
      setOfferNotice(
        data.notificationSuppressed
          ? t("oolshik:taskDetailScreen.offerUnchanged")
          : t("oolshik:taskDetailScreen.offerUpdated"),
      )
    } finally {
      setOfferSaving(false)
    }
  }

  const openPaymentFlow = () => {
    if (!current || !activePayment?.id) return
    const paymentScanPayload: PaymentScanPayload = {
      rawPayload: activePayment.upiIntent ?? "",
      format: "upi-uri",
      payeeVpa: activePayment?.snapshot?.payeeVpa ?? null,
      payeeName: activePayment?.snapshot?.payeeName ?? null,
      txnRef: activePayment?.snapshot?.txnRef ?? null,
      mcc: activePayment?.snapshot?.mcc ?? null,
      merchantId: activePayment?.snapshot?.merchantId ?? null,
      amount:
        typeof activePayment?.snapshot?.amountRequested === "number"
          ? activePayment.snapshot.amountRequested
          : null,
      currency: activePayment?.snapshot?.currency ?? "INR",
      note: activePayment?.snapshot?.note ?? null,
      scanLocation: null,
      scannedAt: activePayment?.snapshot?.createdAt ?? new Date().toISOString(),
      guidelines: [
        t("oolshik:taskDetailScreen.verifyRecipientGuideline"),
        t("oolshik:taskDetailScreen.markPaidGuideline"),
      ],
    }
    const taskContext: PaymentTaskContext = {
      id: String(current.id),
      title: current.title ?? current.description ?? null,
      createdByName: current.createdByName ?? null,
      createdByPhoneNumber: current.createdByPhoneNumber
        ? String(current.createdByPhoneNumber)
        : null,
    }
    navigation.navigate("PaymentPay", {
      taskId: String(current.id),
      paymentRequestId: activePayment.id,
      scanPayload: paymentScanPayload,
      taskContext,
      upiIntentOverride: activePayment.upiIntent,
    })
  }

  const openPaymentsScanner = () => {
    if (rawStatus !== "ASSIGNED") return
    if (!current?.id) return
    const trimmed = helperPaymentAmountInput.trim()
    if (!trimmed) {
      setHelperPaymentAmountError(t("payment:qr.enterAmount"))
      return
    }
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setHelperPaymentAmountError(t("payment:qr.invalidAmount"))
      return
    }
    if (parsed > 1000000) {
      setHelperPaymentAmountError(t("payment:qr.amountTooHigh"))
      return
    }
    setHelperPaymentAmountError(null)
    navigation.navigate("QrScanner", { taskId: String(current.id), amount: Number(parsed.toFixed(2)) })
  }

  const onRevealPhone = async () => {
    if (!current) return
    try {
      setRevealLoading(true)
      setIsRevealed(true)

      // Calls backend to log & return full number
      const res = await OolshikApi.revealPhone(current?.id as any)
      if (res?.ok) {
        const num = res.data?.phoneNumber ?? fullPhone
        // const num = (res.data as { phoneNumber?: string })?.phoneNumber ?? fullPhone
        if (num) setFullPhone(String(num))
        setIsRevealed(true)
      } else {
        const msg = res?.data?.message || t("oolshik:taskDetailScreen.unableShowNumber")
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
      Alert.alert(
        t("task:create.alerts.locationNotReadyTitle"),
        t("task:create.alerts.locationNotReadyBody"),
      )
      return
    }
    if (!current) return
    if (isRequester) {
      Alert.alert(t("oolshik:taskDetailScreen.infoTitle"), t("oolshik:taskDetailScreen.onlyHelpersCanAccept"))
      return
    }
    const result = await accept(current.id, coords.latitude, coords.longitude)
    if (result === "ALREADY") {
      alert(t("oolshik:alreadyAssigned"))
    } else if (result === "OK") {
      alert(t("oolshik:taskDetailScreen.authorizationRequested"))
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
      alert(t("oolshik:taskDetailScreen.acceptError"))
    }
    // reflect status locally
  }

  const onAuthorize = async () => {
    if (!current || actionLoading) return
    setActionLoading(true)
    setRecoveryNotice(t("oolshik:taskDetailScreen.authorizing"))
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
        setRecoveryNotice(t("oolshik:taskDetailScreen.authorizationApproved"))
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
            setRecoveryNotice(t("oolshik:taskDetailScreen.authorizationAlreadyApproved"))
            return
          }
          if (refreshedStatus === "OPEN") {
            setRecoveryNotice(t("oolshik:taskDetailScreen.authorizationExpiredSearching"))
            return
          }
        }
        setRecoveryNotice(t("oolshik:taskDetailScreen.authorizationNotAllowed"))
        return
      }
      throw new Error(t("errors:fallback"))
    } catch {
      setAuthDecision(null)
      Alert.alert(t("task:create.alerts.createFailedTitle"), t("errors:fallback"))
    } finally {
      setActionLoading(false)
    }
  }

  async function openInMaps(lat: number, lon: number, label = "Task") {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      Alert.alert(
        t("oolshik:taskDetailScreen.locationUnavailableTitle"),
        t("oolshik:taskDetailScreen.locationUnavailableBody"),
      )
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

    Alert.alert(
      t("oolshik:taskDetailScreen.noMapsTitle"),
      t("oolshik:taskDetailScreen.noMapsBody", { lat, lon }),
    )
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
      alert(t("oolshik:taskDetailScreen.onlyRequesterCanComplete"))
    } else {
      alert(t("oolshik:taskDetailScreen.errorCompletingTask"))
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
      setRecoveryNotice(t("oolshik:taskDetailScreen.ratingSubmitted"))
    } catch (e) {
      Alert.alert(t("oolshik:taskDetailScreen.ratingFailedTitle"), t("oolshik:taskDetailScreen.ratingFailedBody"))
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
      const snapshot: SubmittedFeedbackSnapshot = {
        rating: cleanRating,
        tags: csatTag ? [csatTag] : undefined,
        submittedAt: new Date().toISOString(),
      }
      saveSubmittedFeedbackSnapshot(key, snapshot)
      setSubmittedCsat(snapshot)
      setCsatSubmitted(true)
      setRecoveryNotice(t("oolshik:taskDetailScreen.thanksForFeedback"))
      return
    }

    Alert.alert(t("oolshik:taskDetailScreen.feedbackFailedTitle"), t("oolshik:taskDetailScreen.feedbackFailedBody"))
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
          <Text text={t("task:create.gettingLocation")} />
        </View>
      )
    }
    if (status === "denied") {
      return (
        <View style={{ paddingVertical: 16, gap: 10 }}>
          <Text preset="heading" text={t("task:create.locationDeniedTitle")} />
          <Text text={t("task:create.locationDeniedBody")} />
          <Button text={t("task:create.openSettings")} onPress={() => Linking.openSettings()} />
        </View>
      )
    }
    if (status === "error") {
      return (
        <View style={{ paddingVertical: 16, gap: 10 }}>
          <Text preset="heading" text={t("task:create.locationErrorTitle")} />
          <Text text={locationError ?? t("errors:fallback")} />
          <Button text={t("task:create.retry")} onPress={refresh} />
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
      Alert.alert(
        t("oolshik:taskDetailScreen.addShortReasonTitle"),
        t("oolshik:taskDetailScreen.addShortReasonBody"),
      )
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
        setRecoveryNotice(t("oolshik:taskDetailScreen.requestCancelledNotice"))
      } else if (reasonModal.action === "release") {
        const res = await OolshikApi.releaseTask(current.id, {
          reasonCode: reasonModal.reasonCode,
          reasonText: reasonModal.reasonText?.trim() || undefined,
        })
        if (!res?.ok) {
          throw new Error("Release failed")
        }
        setTask((t: any) => (t ? { ...t, status: "OPEN", helperId: null } : t))
        setRecoveryNotice(t("oolshik:taskDetailScreen.taskReleasedNotice"))
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
        setRecoveryNotice(t("oolshik:taskDetailScreen.authorizationRejectedNotice"))
      }

      if (coords && status === "ready") {
        await fetchNearby(coords.latitude, coords.longitude)
      }
      closeReasonSheet()
    } catch (e) {
      Alert.alert(t("oolshik:taskDetailScreen.actionFailedTitle"), t("oolshik:taskDetailScreen.actionFailedBody"))
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
      setRecoveryNotice(t("oolshik:taskDetailScreen.requestReopenedNotice"))
      if (coords && status === "ready") {
        await fetchNearby(coords.latitude, coords.longitude)
      }
    } catch (e) {
      Alert.alert(t("oolshik:taskDetailScreen.reassignFailedTitle"), t("oolshik:taskDetailScreen.reassignFailedBody"))
    } finally {
      setActionLoading(false)
    }
  }

  const cancelReasons = useMemo(
    () => [
      { code: "NOT_NEEDED", label: t("oolshik:taskDetailScreen.cancelReasonNotNeeded") },
      { code: "FOUND_ALTERNATIVE", label: t("oolshik:taskDetailScreen.cancelReasonFoundAlternative") },
      { code: "WRONG_TASK", label: t("oolshik:taskDetailScreen.cancelReasonWrongTask") },
      { code: "OTHER", label: t("oolshik:taskDetailScreen.reasonOther") },
    ],
    [t],
  )

  const releaseReasons = useMemo(
    () => [
      { code: "CANT_COMPLETE", label: t("oolshik:taskDetailScreen.releaseReasonCantComplete") },
      { code: "EMERGENCY", label: t("oolshik:taskDetailScreen.releaseReasonEmergency") },
      { code: "OTHER", label: t("oolshik:taskDetailScreen.reasonOther") },
    ],
    [t],
  )

  const rejectReasons = useMemo(
    () => [
      { code: "NOT_COMFORTABLE", label: t("oolshik:taskDetailScreen.rejectReasonNotComfortable") },
      { code: "FOUND_OTHER_HELP", label: t("oolshik:taskDetailScreen.rejectReasonFoundOtherHelp") },
      { code: "WAIT_TOO_LONG", label: t("oolshik:taskDetailScreen.rejectReasonWaitTooLong") },
      { code: "OTHER", label: t("oolshik:taskDetailScreen.reasonOther") },
    ],
    [t],
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
        <Text preset="heading" text={t("oolshik:taskDetail")} />
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
            accessibilityLabel={t("oolshik:taskDetailScreen.refreshTaskDetailsA11y")}
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
            })}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color={colors.palette.primary500} />
            ) : (
              <Text
                text={t("oolshik:taskDetailScreen.refresh")}
                size="xs"
                weight="medium"
                style={{ color: colors.textDim }}
              />
            )}
          </Pressable>
          <Button
            text={t("oolshik:taskDetailScreen.report")}
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
            {loading ? <ActivityIndicator /> : <Text text={t("oolshik:taskDetailScreen.taskNotFound")} />}
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
                <Text text={current.createdByName || t("oolshik:taskCard.someoneNearby")} weight="medium" />
                <Text text={minsAgo(current.createdAt, t)} size="xs" style={{ color: neutral600 }} />
              </View>

              {/* Small play control on the right */}
              {!!current.voiceUrl && (
                <Pressable
                  onPress={togglePlay}
                  accessibilityRole="button"
                  accessibilityLabel={
                    audioLoading
                      ? t("oolshik:taskDetailScreen.loadingVoice")
                      : playing
                        ? t("oolshik:taskDetailScreen.stopVoice")
                        : t("oolshik:taskDetailScreen.playVoice")
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
                text={current.description || t("oolshik:taskDetailScreen.voiceTask")}
                weight="bold"
                style={{ color: neutral700 }}
              />
            </View>

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
              <Text text={t("oolshik:taskDetailScreen.offer")} weight="medium" style={{ color: neutral700 }} />
              <Text text={currentOfferText} size="sm" style={{ color: neutral700 }} />
              {canEditOffer ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <View style={{ flex: 1 }}>
                    <TextField
                      value={offerInput}
                      onChangeText={setOfferInput}
                      placeholder={t("oolshik:taskDetailScreen.setOfferAmount")}
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <Button
                    text={offerSaving ? t("oolshik:taskDetailScreen.saving") : t("oolshik:taskDetailScreen.save")}
                    onPress={onSaveOffer}
                    disabled={offerSaving}
                    style={{ minWidth: 92 }}
                  />
                </View>
              ) : null}
              {offerNotice ? (
                <Text text={offerNotice} size="xs" style={{ color: neutral600 }} />
              ) : null}
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
                      text={t("oolshik:taskDetailScreen.call")}
                      onPress={onCall}
                      disabled={!fullPhone}
                      style={{ paddingVertical: spacing.xs }}
                    />
                  ) : (
                    <Button
                      text={revealLoading ? "…" : t("oolshik:taskDetailScreen.show")}
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
                      text={t("oolshik:taskCard.distanceAway", { distance })}
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
                  accessibilityLabel={t("oolshik:taskDetailScreen.openMapA11y")}
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
                    text={t("oolshik:taskDetailScreen.map")}
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
                  <Text text={t("oolshik:taskDetailScreen.helperRequestedAuthorization")} weight="medium" />
                  <Text
                    text={t("oolshik:taskDetailScreen.requesterLabel", {
                      name: current.createdByName || t("oolshik:taskDetailScreen.requesterFallback"),
                    })}
                    size="xs"
                  />
                  {authCountdown && !authExpired && (
                    <Text text={t("oolshik:taskDetailScreen.approveWithin", { time: authCountdown })} size="xs" />
                  )}
                  {authExpired && <Text text={t("oolshik:taskDetailScreen.authorizationExpired")} size="xs" />}
                  <View style={{ flexDirection: "row", gap: spacing.sm }}>
                    <Button
                      text={actionLoading ? "..." : t("oolshik:taskDetailScreen.approve")}
                      onPress={onAuthorize}
                      disabled={authExpired || actionLoading}
                      style={{ flex: 1, paddingVertical: spacing.xs }}
                    />
                    <Button
                      text={t("oolshik:taskDetailScreen.reject")}
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
                  <Text text={t("oolshik:taskDetailScreen.waitingRequesterApproval")} weight="medium" />
                  <Text
                    text={t("oolshik:taskDetailScreen.requesterLabel", {
                      name: current.createdByName || t("oolshik:taskDetailScreen.requesterFallback"),
                    })}
                    size="xs"
                  />
                  {authCountdown && !authExpired && (
                    <Text text={t("oolshik:taskDetailScreen.timeLeft", { time: authCountdown })} size="xs" />
                  )}
                  {authExpired && <Text text={t("oolshik:taskDetailScreen.authorizationExpired")} size="xs" />}
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
                  <Text text={t("oolshik:taskDetailScreen.awaitingRequesterApproval")} weight="medium" />
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
                    <Text text={t("oolshik:taskDetailScreen.createdThisRequest")} weight="medium" />
                    <Text text={t("oolshik:taskDetailScreen.waitingForHelperToAccept")} size="xs" />
                  </View>
                ) : (
                  <Button
                    text={t("oolshik:acceptTask")}
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
                      <Text text={t("oolshik:taskDetailScreen.canMarkCompleted")} weight="medium" />
                      <Button
                        text={t("oolshik:completeTask")}
                        onPress={onComplete}
                        style={{ flex: 2, paddingVertical: spacing.xs }}
                      />
                    </>
                  ) : (
                    <Text text={t("oolshik:taskDetailScreen.waitingForRequesterToComplete")} weight="medium" />
                  )}
                </View>
              )}
            </View>
          ) : null}
          {canOpenPaymentsScanner ? (
            <View
              style={{
                marginHorizontal: 16,
                marginVertical: 5,
                gap: spacing.xs,
                paddingHorizontal: spacing.sm,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.palette.primary200,
                backgroundColor: colors.palette.primary100,
                paddingBottom: 12,
                paddingTop: 12,
              }}
            >
              <Text text={t("oolshik:taskDetailScreen.payments")} preset="subheading" />
              <Text
                text={t("oolshik:taskDetailScreen.paymentsHint")}
                size="xs"
                style={{ color: neutral700 }}
              />
              <Text text={t("oolshik:taskDetailScreen.amountInr")} size="xs" style={{ color: neutral600 }} />
              <View style={{ flexDirection: "row", alignItems: "stretch", gap: spacing.xs }}>
                <View style={{ flex: 1 }}>
                  <TextField
                    value={helperPaymentAmountInput}
                    onChangeText={(value) => {
                      setHelperPaymentAmountInput(sanitizePaymentAmountInput(value))
                      if (helperPaymentAmountError) setHelperPaymentAmountError(null)
                    }}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    status={helperPaymentAmountError ? "error" : undefined}
                    LeftAccessory={PaymentAmountPrefix}
                    inputWrapperStyle={{ minHeight: 48, borderRadius: 10 }}
                    containerStyle={{ marginBottom: 0 }}
                  />
                </View>
                <Button
                  text={t("oolshik:taskDetailScreen.payments")}
                  onPress={openPaymentsScanner}
                  style={{ minWidth: 120, minHeight: 48, justifyContent: "center" }}
                />
              </View>
              {helperPaymentAmountError ? (
                <Text text={helperPaymentAmountError} size="xs" style={{ color: "#b91c1c" }} />
              ) : null}
            </View>
          ) : null}
          {(isRequester || isHelper) && activePayment ? (
            <View
              style={{
                gap: spacing.xs,
                paddingHorizontal: spacing.sm,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.palette.primary200,
                backgroundColor: colors.palette.primary100,
                marginHorizontal: 16,
                paddingBottom: 14,
                marginVertical: 5,
                paddingTop: 12,
              }}
            >
              <Text text={t("oolshik:taskDetailScreen.paymentUpdate")} preset="subheading" />
              <Text text={paymentStatusText} size="xs" style={{ color: neutral700 }} />
              {typeof activePayment?.snapshot?.amountRequested === "number" && (
                <Text
                  text={t("oolshik:taskDetailScreen.amountValue", {
                    amount: activePayment.snapshot.amountRequested.toFixed(2),
                  })}
                  size="xs"
                  style={{ color: neutral700 }}
                />
              )}
              {paymentExpiresText ? (
                <Text text={paymentExpiresText} size="xs" style={{ color: neutral600 }} />
              ) : null}
              {paymentLoading ? (
                <Text text={t("oolshik:taskDetailScreen.refreshingPaymentStatus")} size="xs" style={{ color: neutral600 }} />
              ) : null}
              {isRequester && paymentCanAct ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Button
                    text={t("oolshik:taskDetailScreen.payWithUpi")}
                    onPress={openPaymentFlow}
                    style={{ flex: 1, paddingVertical: spacing.xs }}
                  />
                  <Button
                    text={t("oolshik:taskDetailScreen.refresh")}
                    onPress={loadActivePayment}
                    style={{ flex: 1, paddingVertical: spacing.xs }}
                  />
                </View>
              ) : isHelper && activePayment?.payerRole === "REQUESTER" ? (
                <Text
                  text={t("oolshik:taskDetailScreen.requesterNotifiedForPayment")}
                  size="xs"
                  style={{ color: neutral600 }}
                />
              ) : null}
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
                  text={
                    isRequester
                      ? t("oolshik:taskDetailScreen.rateYourHelper")
                      : t("oolshik:taskDetailScreen.rateRequester")
                  }
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
                    text={ratingSubmitting ? "..." : t("oolshik:taskDetailScreen.submitRating")}
                    onPress={onSubmitRating}
                    style={{ paddingVertical: spacing.xs }}
                    disabled={ratingSubmitting}
                  />
                </>
              ) : (
                <Text
                  text={t("oolshik:taskDetailScreen.youRated", { rating: myRating.toFixed(1) })}
                  weight="medium"
                />
              )}
              {otherPartyRating != null && (
                <Text
                  text={
                    isRequester
                      ? t("oolshik:taskDetailScreen.helperRatedYou", { rating: otherPartyRating.toFixed(1) })
                      : t("oolshik:taskDetailScreen.requesterRatedYou", {
                          rating: otherPartyRating.toFixed(1),
                        })
                  }
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
                marginVertical: 5,
                paddingBottom: 16,
                paddingTop: 12,
              }}
            >
              <Text text={t("oolshik:taskDetailScreen.overallExperience")} preset="subheading" />
              {csatSubmitted ? (
                <View style={{ gap: spacing.xxs }}>
                  <Text
                    text={t("oolshik:taskDetailScreen.alreadySubmittedThanks")}
                    size="xs"
                    style={{ color: neutral600 }}
                  />
                  {submittedCsat?.rating != null ? (
                    <Text
                      text={t("oolshik:taskDetailScreen.ratingSubmittedValue", {
                        rating: submittedCsat.rating,
                      })}
                      size="xs"
                    />
                  ) : null}
                  {submittedCsat?.tags?.length ? (
                    <Text
                      text={t("oolshik:taskDetailScreen.tagLabel", { tag: submittedCsat.tags.join(", ") })}
                      size="xs"
                    />
                  ) : null}
                  {submittedCsat?.message ? (
                    <Text
                      text={t("oolshik:taskDetailScreen.commentLabel", { comment: submittedCsat.message })}
                      size="xs"
                    />
                  ) : null}
                </View>
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
                          accessibilityLabel={t("oolshik:taskDetailScreen.rateNumberA11y", { value: val })}
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
                    <Text text={t("oolshik:taskDetailScreen.quickTagOptional")} size="xs" style={{ color: neutral600 }} />
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
                      {[
                        t("oolshik:taskDetailScreen.tagSmooth"),
                        t("oolshik:taskDetailScreen.tagHelpful"),
                        t("oolshik:taskDetailScreen.tagClearCommunication"),
                        t("oolshik:taskDetailScreen.tagCouldImprove"),
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
                            accessibilityLabel={t("oolshik:taskDetailScreen.tagA11y", { tag })}
                          >
                            <Text
                              text={tag}
                              size="xs"
                              style={{ color: active ? primary : neutral700 }}
                            />
                          </Pressable>
                        )
                      })}
                    </View>
                  </View>
                  <Button
                    text={csatSubmitting ? "..." : t("oolshik:taskDetailScreen.sendFeedback")}
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
                  text={actionLoading ? "..." : t("oolshik:taskDetailScreen.cancelRequest")}
                  onPress={() => openReasonSheet("cancel")}
                  style={{ paddingVertical: spacing.xs }}
                />
              )}
              {canRelease && (
                <Button
                  text={actionLoading ? "..." : t("oolshik:taskDetailScreen.giveAway")}
                  onPress={() => openReasonSheet("release")}
                  style={{ paddingVertical: spacing.xs }}
                />
              )}
              {isRequester && rawStatus === "ASSIGNED" && !canReassign && reassignCountdown && (
                <Text
                  text={t("oolshik:taskDetailScreen.reassignAvailableIn", { time: reassignCountdown })}
                  size="xs"
                />
              )}
              {canReassign && (
                <Button
                  text={actionLoading ? "..." : t("oolshik:taskDetailScreen.reassignHelper")}
                  onPress={onReassign}
                  style={{ paddingVertical: spacing.xs }}
                />
              )}
              {isRequester &&
                rawStatus === "ASSIGNED" &&
                (current?.reassignedCount ?? 0) >= MAX_REASSIGN && (
                  <Text text={t("oolshik:taskDetailScreen.reassignLimitReached")} size="xs" />
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
              <Text text={t("oolshik:taskDetailScreen.taskCompleted")} weight="bold" style={{ color: success }} />
              <Text style={{ marginBottom: 5 }} text={t("oolshik:taskDetailScreen.thanksForHelping")} size="xs" />
              <Button
                text={t("oolshik:taskDetailScreen.ok")}
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
                  ? t("oolshik:taskDetailScreen.reasonForGivingAway")
                  : reasonModal.action === "reject"
                    ? t("oolshik:taskDetailScreen.reasonForReject")
                    : t("oolshik:taskDetailScreen.reasonForCancel")
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
                placeholder={t("oolshik:taskDetailScreen.addShortNote")}
                containerStyle={{ marginBottom: 0 }}
              />
            )}

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button text={t("oolshik:taskDetailScreen.goBack")} onPress={closeReasonSheet} style={{ flex: 1 }} />
              <Button
                text={actionLoading ? "..." : t("oolshik:taskDetailScreen.confirm")}
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
