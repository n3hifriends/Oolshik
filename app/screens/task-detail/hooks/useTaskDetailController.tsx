import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, Linking, Platform, View, ActivityIndicator } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import { useTaskStore } from "@/store/taskStore"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
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
import type { PaymentScanPayload, PaymentTaskContext, OolshikStackScreenProps } from "@/navigators/OolshikNavigator"
import type { PaymentRequestApiResponse, Task } from "@/api/client"
import type { TextFieldAccessoryProps } from "@/components/TextField"
import { canEditOfferForTask, parseOfferInput } from "@/utils/offerRules"
import {
  formatDistance,
  getInitials,
  maskPhoneNumber,
  minsAgo,
  paymentExpiryText,
  paymentStatusLabel,
  sanitizePaymentAmountInput,
  type TranslateFn,
} from "@/screens/task-detail/helpers/taskDetailFormatters"
import {
  isHelperForTask,
  isPendingHelperForTask,
  isRequesterForTask,
  normalizeTaskStatus,
} from "@/screens/task-detail/helpers/taskDetailGuards"
import { useTaskTimers } from "@/screens/task-detail/hooks/useTaskTimers"
import {
  authorizeRequest,
  cancelTask,
  completeTask,
  fetchActivePaymentRequest,
  fetchTaskById,
  rateTask,
  reassignTask,
  rejectRequest,
  releaseTask,
  revealPhone,
  updateTaskOffer,
} from "@/screens/task-detail/requesters/taskDetailRequester"
import type { RecoveryAction, ReasonModalState, StatusPaletteMap, TaskDetailTask } from "@/screens/task-detail/types"

const MAX_REASSIGN = 2

type Navigation = OolshikStackScreenProps<"OolshikDetail">["navigation"]

function toTaskDetailTask(task: Task | null | undefined): TaskDetailTask | null {
  if (!task) return null
  return task as TaskDetailTask
}

function getTaskPhoneNumber(task: TaskDetailTask | null, isRequester: boolean) {
  const requesterPhone = task?.requesterPhoneNumber || task?.createdByPhoneNumber || task?.phoneNumber
  const helperPhone = task?.helperPhoneNumber || task?.helperPhone
  return isRequester ? helperPhone : requesterPhone
}

export function useTaskDetailController({
  taskId,
  navigation,
  t,
}: {
  taskId: string
  navigation: Navigation
  t: TranslateFn
}) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme

  const { tasks, accept, fetchNearby, upsertTask } = useTaskStore()
  const { userId } = useAuth()

  const taskFromStore = useMemo(
    () => toTaskDetailTask(tasks.find((candidate) => String(candidate.id) === String(taskId)) as Task | undefined),
    [tasks, taskId],
  )

  const [loading, setLoading] = useState(!taskFromStore)
  const [task, setTask] = useState<TaskDetailTask | null>(taskFromStore)

  const current = task || taskFromStore || null
  const playbackUri = current?.voiceUrl == null ? null : String(current.voiceUrl).trim() || null

  const { status: playbackStatus, toggle, stop } = useAudioPlaybackForUri(
    playbackUri,
    current?.id ? `detail-${current.id}` : "detail",
  )

  const { coords, status, error: locationError, refresh } = useForegroundLocation()

  const [actionLoading, setActionLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null)
  const [authDecision, setAuthDecision] = useState<"approved" | "rejected" | null>(null)
  const [rating, setRating] = useState<number>(2.5)
  const authExpiredRef = useRef(false)

  const [csatRating, setCsatRating] = useState(4)
  const [csatTag, setCsatTag] = useState<string | null>(null)
  const [csatSubmitting, setCsatSubmitting] = useState(false)
  const [csatSubmitted, setCsatSubmitted] = useState(false)
  const [submittedCsat, setSubmittedCsat] = useState<SubmittedFeedbackSnapshot | null>(null)

  const [fullPhone, setFullPhone] = useState<string | null>(null)
  const [isRevealed, setIsRevealed] = useState(false)
  const [revealLoading, setRevealLoading] = useState(false)

  const [reasonModal, setReasonModal] = useState<ReasonModalState>({ visible: false })
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

  const statusMap: StatusPaletteMap = {
    PENDING: { label: t("oolshik:status.pending"), bg: primarySoft, fg: primary },
    PENDING_AUTH: { label: t("oolshik:status.pendingAuth"), bg: colors.palette.primary100, fg: primary },
    ASSIGNED: { label: t("oolshik:status.assigned"), bg: warningSoft, fg: warning },
    COMPLETED: { label: t("oolshik:status.completed"), bg: successSoft, fg: success },
    CANCELLED: { label: t("oolshik:status.cancelled"), bg: colors.palette.neutral200, fg: neutral700 },
  }

  useFocusEffect(
    useCallback(() => {
      refresh()
      return () => {
        void stop()
      }
    }, [refresh, stop]),
  )

  const rawStatus = current?.status
  const normalizedStatus = normalizeTaskStatus(rawStatus)

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

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(!taskFromStore)
      try {
        const res = await fetchTaskById(taskId)
        if (!cancelled && res.ok && res.data) {
          setTask(toTaskDetailTask(res.data))
        }
      } catch {
        // Keep current state; avoid leaving the screen in a loading state on transient failures.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [taskId, taskFromStore])

  const refreshTask = useCallback(async () => {
    if (!taskId || refreshing) return
    setRefreshing(true)
    try {
      const res = await fetchTaskById(taskId)
      if (res.ok && res.data) {
        const nextTask = toTaskDetailTask(res.data)
        setTask(nextTask)
        if (nextTask) upsertTask(nextTask)
        return
      }
      Alert.alert(
        t("oolshik:taskDetailScreen.refreshFailedTitle"),
        res.message || t("oolshik:taskDetailScreen.refreshFailedBody"),
      )
    } finally {
      setRefreshing(false)
    }
  }, [refreshing, taskId, t, upsertTask])

  const statusChip = statusMap[normalizedStatus] ?? statusMap.PENDING

  const isRequester = isRequesterForTask(current?.requesterId, userId)
  const isHelper = isHelperForTask(current?.helperId, userId)
  const isPendingHelper = isPendingHelperForTask(current?.pendingHelperId, userId)

  const loadActivePayment = useCallback(async () => {
    if (!taskId || (!isRequester && !isHelper)) {
      setActivePayment(null)
      return
    }

    setPaymentLoading(true)
    try {
      const res = await fetchActivePaymentRequest(taskId)
      if (res.ok && res.data) {
        setActivePayment(res.data)
        return
      }
      if (res.status === 404) {
        setActivePayment(null)
        return
      }
      setActivePayment(null)
    } catch {
      setActivePayment(null)
    } finally {
      setPaymentLoading(false)
    }
  }, [isHelper, isRequester, taskId])

  const contactLabel = isRequester
    ? t("oolshik:taskDetailScreen.contactHelperPhone")
    : t("oolshik:taskDetailScreen.contactRequesterPhone")

  const hasHelper = !!current?.helperId || !!current?.pendingHelperId
  const canViewContact = isRequester
    ? !!rawStatus && rawStatus !== "OPEN" && hasHelper
    : !!fullPhone

  useEffect(() => {
    const nextPhone = getTaskPhoneNumber(current, isRequester)
    setFullPhone(nextPhone ? String(nextPhone) : null)
    setIsRevealed(false)
  }, [
    current?.requesterPhoneNumber,
    current?.createdByPhoneNumber,
    current?.phoneNumber,
    current?.helperPhone,
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

  const { msUntilReassign, msUntilAuthExpiry, reassignCountdown, authCountdown, authExpired } = useTaskTimers({
    rawStatus,
    helperAcceptedAt: current?.helperAcceptedAt,
    pendingAuthExpiresAt: current?.pendingAuthExpiresAt,
  })

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

    const refreshAfterExpiry = async () => {
      try {
        const res = await fetchTaskById(taskId)
        if (res.ok && res.data) {
          setTask(toTaskDetailTask(res.data))
        }

        if (coords && status === "ready") {
          await fetchNearby(coords.latitude, coords.longitude)
        }
      } catch {
        // best-effort refresh
      }
    }

    void refreshAfterExpiry()
  }, [coords, fetchNearby, msUntilAuthExpiry, rawStatus, status, t, taskId])

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
  }, [activePayment?.id, activePayment?.snapshot?.amountRequested, isHelper])

  useEffect(() => {
    if (!current?.id) {
      setActivePayment(null)
      return
    }
    if (rawStatus === "CANCELLED" || rawStatus === "COMPLETED" || rawStatus === "OPEN") {
      setActivePayment(null)
      return
    }
    void loadActivePayment()
  }, [current?.id, current?.updatedAt, loadActivePayment, rawStatus])

  const canReassign =
    isRequester &&
    rawStatus === "ASSIGNED" &&
    msUntilReassign === 0 &&
    (current?.reassignedCount ?? 0) < MAX_REASSIGN

  const activePaymentStatus = (activePayment?.status ?? activePayment?.snapshot?.status ?? "").toUpperCase()
  const paymentAwaitingUser = activePaymentStatus === "PENDING" || activePaymentStatus === "INITIATED"
  const paymentCanAct = !!activePayment?.canPay && paymentAwaitingUser
  const paymentStatusText = paymentStatusLabel(activePaymentStatus, t)
  const paymentExpiresText = paymentExpiryText(activePayment?.snapshot?.expiresAt, t)
  const canOpenPaymentsScanner = isHelper && !!current?.id && rawStatus === "ASSIGNED"

  const PaymentAmountPrefix = useCallback(
    ({ style }: TextFieldAccessoryProps) => (
      <View style={[style, { justifyContent: "center" }]}>
        <Text text="₹" weight="medium" style={{ color: neutral700 }} />
      </View>
    ),
    [neutral700],
  )

  const onSaveOffer = useCallback(async () => {
    if (!current || !canEditOffer || offerSaving) return

    const parsedOffer = parseOfferInput(offerInput)
    if (!parsedOffer.ok) {
      Alert.alert(
        t("task:create.alerts.invalidOfferTitle"),
        parsedOffer.error || t("task:create.alerts.invalidOfferBody"),
      )
      return
    }

    setOfferSaving(true)
    try {
      const res = await updateTaskOffer(String(current.id), {
        offerAmount: parsedOffer.amount,
        offerCurrency: "INR",
      })

      if (!res.ok || !res.data) {
        Alert.alert(t("task:create.alerts.createFailedTitle"), res.message || t("errors:fallback"))
        return
      }

      setTask((prev) =>
        prev
          ? {
              ...prev,
              offerAmount:
                typeof res.data?.offerAmount === "number" ? res.data.offerAmount : parsedOffer.amount,
              offerCurrency: res.data?.offerCurrency ?? "INR",
              offerUpdatedAt: res.data?.offerUpdatedAt ?? new Date().toISOString(),
            }
          : prev,
      )

      setOfferNotice(
        res.data.notificationSuppressed
          ? t("oolshik:taskDetailScreen.offerUnchanged")
          : t("oolshik:taskDetailScreen.offerUpdated"),
      )
    } finally {
      setOfferSaving(false)
    }
  }, [canEditOffer, current, offerInput, offerSaving, t])

  const openPaymentFlow = useCallback(() => {
    if (!current || !activePayment?.id) return

    const paymentScanPayload: PaymentScanPayload = {
      rawPayload: activePayment.upiIntent ?? "",
      format: "upi-uri",
      payeeVpa: activePayment.snapshot?.payeeVpa ?? null,
      payeeName: activePayment.snapshot?.payeeName ?? null,
      txnRef: activePayment.snapshot?.txnRef ?? null,
      mcc: activePayment.snapshot?.mcc ?? null,
      merchantId: activePayment.snapshot?.merchantId ?? null,
      amount:
        typeof activePayment.snapshot?.amountRequested === "number"
          ? activePayment.snapshot.amountRequested
          : null,
      currency: activePayment.snapshot?.currency ?? "INR",
      note: activePayment.snapshot?.note ?? null,
      scanLocation: null,
      scannedAt: activePayment.snapshot?.createdAt ?? new Date().toISOString(),
      guidelines: [
        t("oolshik:taskDetailScreen.verifyRecipientGuideline"),
        t("oolshik:taskDetailScreen.markPaidGuideline"),
      ],
    }

    const taskContext: PaymentTaskContext = {
      id: String(current.id),
      title: current.title ?? current.description ?? null,
      createdByName: current.createdByName ?? null,
      createdByPhoneNumber: current.createdByPhoneNumber ? String(current.createdByPhoneNumber) : null,
    }

    navigation.navigate("PaymentPay", {
      taskId: String(current.id),
      paymentRequestId: activePayment.id,
      scanPayload: paymentScanPayload,
      taskContext,
      upiIntentOverride: activePayment.upiIntent,
    })
  }, [activePayment, current, navigation, t])

  const openPaymentsScanner = useCallback(() => {
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
  }, [current?.id, helperPaymentAmountInput, navigation, rawStatus, t])

  const onRevealPhone = useCallback(async () => {
    if (!current?.id) return

    try {
      setRevealLoading(true)
      setIsRevealed(true)
      const res = await revealPhone(String(current.id))
      if (res.ok) {
        const phone = res.data?.phoneNumber ?? fullPhone
        if (phone) setFullPhone(String(phone))
        setIsRevealed(true)
      } else {
        Alert.alert(res.message || t("oolshik:taskDetailScreen.unableShowNumber"))
      }
    } finally {
      setRevealLoading(false)
    }
  }, [current?.id, fullPhone, t])

  const onCall = useCallback(() => {
    const number = (fullPhone || "").replace(/[^+\d]/g, "")
    if (number) {
      void Linking.openURL(`tel:${number}`)
    }
  }, [fullPhone])

  const onAccept = useCallback(async () => {
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
      Alert.alert(t("oolshik:alreadyAssigned"))
      return
    }

    if (result === "OK") {
      Alert.alert(t("oolshik:taskDetailScreen.authorizationRequested"))
      setTask((prev) =>
        prev
          ? {
              ...prev,
              status: "PENDING_AUTH",
              pendingAuthExpiresAt: new Date(Date.now() + 120 * 1000).toISOString(),
            }
          : prev,
      )

      const refreshed = await fetchTaskById(String(current.id))
      if (refreshed.ok && refreshed.data) {
        setTask(toTaskDetailTask(refreshed.data))
      }
      return
    }

    Alert.alert(t("oolshik:taskDetailScreen.acceptError"))
  }, [accept, coords, current, isRequester, refresh, status, t])

  const onAuthorize = useCallback(async () => {
    if (!current?.id || actionLoading) return

    setActionLoading(true)
    setRecoveryNotice(t("oolshik:taskDetailScreen.authorizing"))

    try {
      const res = await authorizeRequest(String(current.id))
      if (res.ok) {
        setAuthDecision("approved")
        if (res.data) {
          setTask((prev) =>
            prev
              ? {
                  ...prev,
                  ...res.data,
                  status: "ASSIGNED",
                  pendingAuthExpiresAt: null,
                }
              : {
                  ...(res.data as TaskDetailTask),
                  status: "ASSIGNED",
                  pendingAuthExpiresAt: null,
                },
          )
        } else {
          setTask((prev) => (prev ? { ...prev, status: "ASSIGNED", pendingAuthExpiresAt: null } : prev))
        }

        setRecoveryNotice(t("oolshik:taskDetailScreen.authorizationApproved"))

        if (coords && status === "ready") {
          await fetchNearby(coords.latitude, coords.longitude)
        }
        return
      }

      if (res.status === 409) {
        const refreshed = await fetchTaskById(String(current.id))
        if (refreshed.ok && refreshed.data) {
          const refreshedTask = toTaskDetailTask(refreshed.data)
          setTask(refreshedTask)
          const refreshedStatus = refreshedTask?.status

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

      throw new Error("authorize-failed")
    } catch {
      setAuthDecision(null)
      Alert.alert(t("task:create.alerts.createFailedTitle"), t("errors:fallback"))
    } finally {
      setActionLoading(false)
    }
  }, [actionLoading, coords, current?.id, fetchNearby, status, t])

  const onComplete = useCallback(async () => {
    if (!current?.id) return

    const res = await completeTask(String(current.id))
    if (res.ok) {
      setTask((prev) => (prev ? { ...prev, status: "COMPLETED" } : prev))
      return
    }

    if (
      res.status === 403 ||
      res.status === 409 ||
      String(res.data || "").includes("Only requester can complete")
    ) {
      Alert.alert(t("oolshik:taskDetailScreen.onlyRequesterCanComplete"))
      return
    }

    Alert.alert(t("oolshik:taskDetailScreen.errorCompletingTask"))
  }, [current?.id, t])

  const onSubmitRating = useCallback(async () => {
    if (!current?.id) return
    if (!isRequester && !isHelper) return
    if (myRating != null) return

    setRatingSubmitting(true)
    try {
      const res = await rateTask(String(current.id), {
        rating,
        feedback: undefined,
      })

      if (!res.ok) {
        throw new Error("rating-failed")
      }

      setTask((prev) =>
        prev
          ? {
              ...prev,
              ratingByRequester: isRequester ? rating : prev.ratingByRequester,
              ratingByHelper: isHelper ? rating : prev.ratingByHelper,
            }
          : prev,
      )
      setRecoveryNotice(t("oolshik:taskDetailScreen.ratingSubmitted"))
    } catch {
      Alert.alert(
        t("oolshik:taskDetailScreen.ratingFailedTitle"),
        t("oolshik:taskDetailScreen.ratingFailedBody"),
      )
    } finally {
      setRatingSubmitting(false)
    }
  }, [current?.id, isHelper, isRequester, myRating, rating, t])

  const onSubmitCsat = useCallback(async () => {
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

    Alert.alert(
      t("oolshik:taskDetailScreen.feedbackFailedTitle"),
      t("oolshik:taskDetailScreen.feedbackFailedBody"),
    )
  }, [csatRating, csatSubmitted, csatSubmitting, csatTag, current?.id, t])

  const openReasonSheet = useCallback((action: RecoveryAction) => {
    setReasonModal({
      visible: true,
      action,
      reasonCode: undefined,
      reasonText: "",
    })
  }, [])

  const closeReasonSheet = useCallback(() => {
    setReasonModal({ visible: false })
  }, [])

  const onConfirmReason = useCallback(async () => {
    if (!current?.id || !reasonModal.action || !reasonModal.reasonCode) return

    if (reasonModal.reasonCode === "OTHER" && !reasonModal.reasonText?.trim()) {
      Alert.alert(
        t("oolshik:taskDetailScreen.addShortReasonTitle"),
        t("oolshik:taskDetailScreen.addShortReasonBody"),
      )
      return
    }

    setActionLoading(true)

    try {
      const payload = {
        reasonCode: reasonModal.reasonCode,
        reasonText: reasonModal.reasonText?.trim() || undefined,
      }

      if (reasonModal.action === "cancel") {
        const res = await cancelTask(String(current.id), payload)
        if (!res.ok) throw new Error("cancel-failed")
        setTask((prev) => (prev ? { ...prev, status: "CANCELLED" } : prev))
        setRecoveryNotice(t("oolshik:taskDetailScreen.requestCancelledNotice"))
      } else if (reasonModal.action === "release") {
        const res = await releaseTask(String(current.id), payload)
        if (!res.ok) throw new Error("release-failed")
        setTask((prev) => (prev ? { ...prev, status: "OPEN", helperId: null } : prev))
        setRecoveryNotice(t("oolshik:taskDetailScreen.taskReleasedNotice"))
      } else if (reasonModal.action === "reject") {
        const res = await rejectRequest(String(current.id), payload)
        if (!res.ok) throw new Error("reject-failed")
        if (res.data) {
          setTask((prev) => (prev ? { ...prev, ...res.data } : (res.data as TaskDetailTask)))
        } else {
          setTask((prev) => (prev ? { ...prev, status: "OPEN", pendingHelperId: null } : prev))
        }
        setRecoveryNotice(t("oolshik:taskDetailScreen.authorizationRejectedNotice"))
      }

      if (coords && status === "ready") {
        await fetchNearby(coords.latitude, coords.longitude)
      }
      closeReasonSheet()
    } catch {
      Alert.alert(t("oolshik:taskDetailScreen.actionFailedTitle"), t("oolshik:taskDetailScreen.actionFailedBody"))
    } finally {
      setActionLoading(false)
    }
  }, [closeReasonSheet, coords, current?.id, fetchNearby, reasonModal.action, reasonModal.reasonCode, reasonModal.reasonText, status, t])

  const onReassign = useCallback(async () => {
    if (!current?.id) return

    setActionLoading(true)
    try {
      const res = await reassignTask(String(current.id))
      if (!res.ok) throw new Error("reassign-failed")

      setTask((prev) => (prev ? { ...prev, status: "OPEN", helperId: null } : prev))
      setRecoveryNotice(t("oolshik:taskDetailScreen.requestReopenedNotice"))

      if (coords && status === "ready") {
        await fetchNearby(coords.latitude, coords.longitude)
      }
    } catch {
      Alert.alert(
        t("oolshik:taskDetailScreen.reassignFailedTitle"),
        t("oolshik:taskDetailScreen.reassignFailedBody"),
      )
    } finally {
      setActionLoading(false)
    }
  }, [coords, current?.id, fetchNearby, status, t])

  const openInMaps = useCallback(
    async (lat: number, lon: number, label = "Task") => {
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
        if (Platform.OS === "android" && (await Linking.canOpenURL(geo))) {
          await Linking.openURL(geo)
          return
        }

        const primaryMaps = Platform.OS === "ios" ? appleMaps : googleWeb
        if (await Linking.canOpenURL(primaryMaps)) {
          await Linking.openURL(primaryMaps)
          return
        }

        if (await Linking.canOpenURL(googleWeb)) {
          await Linking.openURL(googleWeb)
          return
        }
      } catch {
        // fall through to alert
      }

      Alert.alert(t("oolshik:taskDetailScreen.noMapsTitle"), t("oolshik:taskDetailScreen.noMapsBody", { lat, lon }))
    },
    [t],
  )

  const renderLocationState = useCallback(() => {
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
          <Button
            text={t("task:create.openSettings")}
            onPress={() => {
              void Linking.openSettings()
            }}
          />
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
  }, [locationError, refresh, status, t])

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

  const ratingBadgeValue = normalizedStatus === "COMPLETED" ? otherPartyRating : oppositeAvgRating
  const showRatingBadge = ratingBadgeValue != null
  const canRate = normalizedStatus === "COMPLETED" && (isRequester || isHelper)
  const distanceLabel = formatDistance(current?.distanceMtr, t)

  const paymentAmountText =
    typeof activePayment?.snapshot?.amountRequested === "number"
      ? t("oolshik:taskDetailScreen.amountValue", {
          amount: activePayment.snapshot.amountRequested.toFixed(2),
        })
      : null

  const tags = [
    t("oolshik:taskDetailScreen.tagSmooth"),
    t("oolshik:taskDetailScreen.tagHelpful"),
    t("oolshik:taskDetailScreen.tagClearCommunication"),
    t("oolshik:taskDetailScreen.tagCouldImprove"),
  ]

  return {
    theme: {
      spacing,
      colors,
      primary,
      success,
      successSoft,
      neutral600,
      neutral700,
    },
    state: {
      loading,
      refreshing,
      actionLoading,
      ratingSubmitting,
      recoveryNotice,
      authDecision,
      csatRating,
      csatTag,
      csatSubmitting,
      csatSubmitted,
      submittedCsat,
      isRevealed,
      revealLoading,
      reasonModal,
      activePayment,
      paymentLoading,
      offerInput,
      offerSaving,
      offerNotice,
      helperPaymentAmountInput,
      helperPaymentAmountError,
      status,
      locationError,
    },
    current,
    playback: {
      audioLoading: playbackStatus === "loading",
      playing: playbackStatus === "playing",
    },
    role: {
      isRequester,
      isHelper,
      isPendingHelper,
    },
    statusInfo: {
      rawStatus,
      normalizedStatus,
      statusChip,
      authCountdown,
      authExpired,
      reassignCountdown,
      canReassign,
      canCancel,
      canRelease,
    },
    contact: {
      contactLabel,
      canViewContact,
      displayPhone: isRevealed && fullPhone ? String(fullPhone) : maskPhoneNumber(fullPhone || "•••••••••••••"),
      canCall: !!fullPhone,
    },
    offer: {
      canEditOffer,
      currentOfferText,
    },
    payment: {
      paymentStatusText,
      paymentExpiresText,
      canOpenPaymentsScanner,
      paymentCanAct,
      paymentAmountText,
      paymentAwaitingUser,
      PaymentAmountPrefix,
    },
    rating: {
      rating,
      setRating,
      myRating,
      otherPartyRating,
      canRate,
      showRatingBadge,
      ratingBadgeValue,
    },
    derived: {
      initials: getInitials(current?.createdByName),
      createdAtLabel: minsAgo(current?.createdAt, t),
      description: current?.description || t("oolshik:taskDetailScreen.voiceTask"),
      requesterName: current?.createdByName || t("oolshik:taskDetailScreen.requesterFallback"),
      distanceLabel,
      distanceAwayText: t("oolshik:taskCard.distanceAway", { distance: distanceLabel ?? "" }),
      canOpenMap: typeof current?.latitude === "number" && typeof current?.longitude === "number",
      reassignLimitReached: (current?.reassignedCount ?? 0) >= MAX_REASSIGN,
      paymentRequesterNotified: isHelper && activePayment?.payerRole === "REQUESTER",
      tagStrings: tags,
      ratingTexts: {
        youRated: myRating != null
          ? t("oolshik:taskDetailScreen.youRated", { rating: myRating.toFixed(1) })
          : "",
        helperRatedYou:
          otherPartyRating != null
            ? t("oolshik:taskDetailScreen.helperRatedYou", { rating: otherPartyRating.toFixed(1) })
            : "",
        requesterRatedYou:
          otherPartyRating != null
            ? t("oolshik:taskDetailScreen.requesterRatedYou", { rating: otherPartyRating.toFixed(1) })
            : "",
        ratingSubmittedValue:
          submittedCsat?.rating != null
            ? t("oolshik:taskDetailScreen.ratingSubmittedValue", { rating: submittedCsat.rating })
            : undefined,
        tagSubmitted:
          submittedCsat?.tags?.length
            ? t("oolshik:taskDetailScreen.tagLabel", { tag: submittedCsat.tags.join(", ") })
            : undefined,
        commentSubmitted:
          submittedCsat?.message
            ? t("oolshik:taskDetailScreen.commentLabel", { comment: submittedCsat.message })
            : undefined,
      },
    },
    reasons: {
      currentReasons,
      cancelReasons,
      releaseReasons,
      rejectReasons,
    },
    handlers: {
      refreshTask,
      setOfferInput,
      onSaveOffer,
      onRevealPhone,
      onCall,
      togglePlay: toggle,
      openMap: () => openInMaps(current?.latitude || 0, current?.longitude || 0),
      onAccept,
      onAuthorize,
      onComplete,
      onSubmitRating,
      onSubmitCsat,
      openReasonSheet,
      closeReasonSheet,
      setReasonCode: (code: string) => {
        setReasonModal((prev) => ({ ...prev, reasonCode: code }))
      },
      setReasonText: (value: string) => {
        setReasonModal((prev) => ({ ...prev, reasonText: value }))
      },
      onConfirmReason,
      onReassign,
      openPaymentFlow,
      openPaymentsScanner,
      loadActivePayment,
      onHelperPaymentAmountChange: (value: string) => {
        setHelperPaymentAmountInput(sanitizePaymentAmountInput(value))
        if (helperPaymentAmountError) setHelperPaymentAmountError(null)
      },
      setCsatRating,
      toggleCsatTag: (tag: string) => setCsatTag((prev) => (prev === tag ? null : tag)),
      renderLocationState,
      goBack: () => navigation.goBack(),
      openReport: () => navigation.navigate("OolshikReport", { taskId: current?.id }),
    },
  }
}
