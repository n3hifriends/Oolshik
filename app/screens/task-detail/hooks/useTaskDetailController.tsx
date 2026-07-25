import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { setRequestContext, clearRequestContext, breadcrumb } from "@/utils/crashReporting"
import { Alert, InteractionManager, Linking, View, ActivityIndicator } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import { normalizeRating } from "@/components/StarRating/utils"
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
import {
  hasShownFeedbackPrompt,
  hasSeenFeedbackLaterAlert,
  markFeedbackLaterAlertSeen,
  markFeedbackPromptShown,
} from "@/features/feedback/storage/taskFeedbackPromptGate"
import { AnalyticsEvent, logEvent } from "@/services/analytics"
import type {
  PaymentScanPayload,
  PaymentTaskContext,
  OolshikStackScreenProps,
} from "@/navigators/OolshikNavigator"
import { OolshikApi } from "@/api"
import { getRemoteFlag } from "@/services/remoteConfig"
import {
  getAvailableMapProviders,
  launchMapProvider,
  type MapProviderId,
  type MapProviderOption,
} from "@/utils/mapNavigation"
import { getStatusColors } from "@/theme/statusColors"
import type {
  PaymentProfileApiResponse,
  PaymentPayerRole,
  PaymentRequestApiResponse,
  Task,
} from "@/api/client"
import type { TextFieldAccessoryProps } from "@/components/TextField"
import { canEditOfferForTask, parseOfferInput } from "@/utils/offerRules"
import {
  hasSeenPaymentNotice,
  markPaymentNoticeSeen,
  type PaymentNoticeIntent,
} from "@/screens/task-detail/helpers/paymentNoticeGate"
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
  confirmTaskCompletion,
  fetchActivePaymentRequests,
  fetchTaskById,
  markTaskDone,
  rateTask,
  reassignTask,
  rejectRequest,
  reportTaskIssue,
  releaseTask,
  revealPhone,
  updateTaskOffer,
} from "@/screens/task-detail/requesters/taskDetailRequester"
import type {
  RecoveryAction,
  ReasonModalState,
  StatusPaletteMap,
  TaskDetailTask,
} from "@/screens/task-detail/types"

const MAX_REASSIGN = 2
const TRANSCRIPTION_POLL_MAX_ATTEMPTS = 36

type Navigation = OolshikStackScreenProps<"OolshikDetail">["navigation"]

function toTaskDetailTask(task: Task | null | undefined): TaskDetailTask | null {
  if (!task) return null
  return task as TaskDetailTask
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.trim() : ""
}

function isPlaceholderTitle(value: unknown): boolean {
  const text = normalizeText(value)
  return !text || text === "..."
}

function isWaitingForTranscription(task: TaskDetailTask | null): boolean {
  if (!task) return false
  const voiceUrl = normalizeText(task.voiceUrl)
  return !!voiceUrl && isPlaceholderTitle(task.title) && !normalizeText(task.description)
}

function getTaskDisplayText(task: TaskDetailTask | null, fallback: string): string {
  const description = normalizeText(task?.description)
  if (description) return description

  const title = normalizeText(task?.title)
  if (title && !isPlaceholderTitle(title)) return title

  return fallback
}

function getTaskPhoneNumber(task: TaskDetailTask | null, isRequester: boolean) {
  const requesterPhone =
    task?.requesterPhoneNumber || task?.createdByPhoneNumber || task?.phoneNumber
  const helperPhone = task?.helperPhoneNumber || task?.helperPhone
  return isRequester ? helperPhone : requesterPhone
}

function resolveDirectPaymentErrorCopy(
  payerRole: PaymentPayerRole,
  rawMessage: string | null | undefined,
  t: TranslateFn,
) {
  const message = (rawMessage || "").trim()
  const normalized = message.toLowerCase()
  const missingProfile =
    normalized.includes("errors.paymentprofile.missing") ||
    normalized.includes("add your payment profile before using direct payments")
  const targetUnavailable =
    normalized.includes("errors.paymentprofile.targetunavailable") ||
    normalized.includes("targetunavailable")

  if (payerRole === "HELPER" && (missingProfile || targetUnavailable)) {
    return {
      title: t("payment:direct.requesterProfileMissingTitle"),
      body: t("payment:direct.requesterProfileMissingBody"),
      showAddProfileCta: false,
    }
  }

  if (payerRole === "REQUESTER" && (missingProfile || targetUnavailable)) {
    return {
      title: t("payment:direct.profileRequiredTitle"),
      body: t("payment:direct.profileRequiredBody"),
      showAddProfileCta: true,
    }
  }

  return {
    title: t("payment:direct.createFailedTitle"),
    body: message || t("payment:direct.createFailed"),
    showAddProfileCta: false,
  }
}

function toFirstName(fullName: string, max = 12): string {
  const first = fullName.split(" ")[0]
  return first.length > max ? first.slice(0, 10) + "…" : first
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

  const { tasks, accept, fetchNearby, fetchActiveSummary, upsertTask } = useTaskStore()
  const { userId } = useAuth()

  const taskFromStore = useMemo(
    () =>
      toTaskDetailTask(
        tasks.find((candidate) => String(candidate.id) === String(taskId)) as Task | undefined,
      ),
    [tasks, taskId],
  )

  const [loading, setLoading] = useState(!taskFromStore)
  const [task, setTask] = useState<TaskDetailTask | null>(taskFromStore)

  const current = task || taskFromStore || null
  const playbackUri = current?.voiceUrl == null ? null : String(current.voiceUrl).trim() || null

  const {
    status: playbackStatus,
    toggle,
    stop,
  } = useAudioPlaybackForUri(playbackUri, current?.id ? `detail-${current.id}` : "detail")

  const { coords, status, error: locationError, refresh } = useForegroundLocation()

  const [actionLoading, setActionLoading] = useState(false)
  const [actionKind, setActionKind] = useState<null | "confirmCompletion" | "completeTask">(null)
  const [refreshing, setRefreshing] = useState(false)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [recoveryNotice, setRecoveryNotice] = useState<string | null>(null)
  const [authDecision, setAuthDecision] = useState<"approved" | "rejected" | null>(null)
  const [rating, setRating] = useState<number>(2.5)
  const authExpiredRef = useRef(false)
  const refreshInFlightRef = useRef(false)
  const paymentNoticeDialogOpenRef = useRef(false)
  const [markDoneConfirmVisible, setMarkDoneConfirmVisible] = useState(false)
  const [confirmCompletionDialogVisible, setConfirmCompletionDialogVisible] = useState(false)

  const [csatRating, setCsatRating] = useState(4)
  const [csatTag, setCsatTag] = useState<string | null>(null)
  const [csatSubmitting, setCsatSubmitting] = useState(false)
  const [csatSubmitted, setCsatSubmitted] = useState(false)
  const [submittedCsat, setSubmittedCsat] = useState<SubmittedFeedbackSnapshot | null>(null)

  const [fullPhone, setFullPhone] = useState<string | null>(null)
  const [isRevealed, setIsRevealed] = useState(false)
  const [revealLoading, setRevealLoading] = useState(false)

  const [reasonModal, setReasonModal] = useState<ReasonModalState>({ visible: false })
  const [mapChooser, setMapChooser] = useState<{
    visible: boolean
    lat: number
    lon: number
    label: string
    options: MapProviderOption[]
  }>({ visible: false, lat: 0, lon: 0, label: "", options: [] })
  const [activePayments, setActivePayments] = useState<PaymentRequestApiResponse[]>([])
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [offerInput, setOfferInput] = useState("")
  const [offerSaving, setOfferSaving] = useState(false)
  const [offerNotice, setOfferNotice] = useState<string | null>(null)
  const [helperPaymentAmountInput, setHelperPaymentAmountInput] = useState("")
  const [helperPaymentAmountError, setHelperPaymentAmountError] = useState<string | null>(null)
  const [myPaymentProfile, setMyPaymentProfile] = useState<PaymentProfileApiResponse>({
    hasProfile: false,
  })
  const [myPaymentProfileLoading, setMyPaymentProfileLoading] = useState(true)

  const primary = colors.palette.primary500
  const neutral600 = colors.palette.neutral600
  const neutral700 = colors.palette.neutral700
  const success = colors.palette.success500
  const successSoft = colors.palette.successSoft400

  const sc = (s: string) => getStatusColors(s, theme.isDark)
  const statusMap: StatusPaletteMap = {
    PENDING:                        { label: t("oolshik:status.pending"),               ...sc("PENDING") },
    PENDING_AUTH:                   { label: t("oolshik:status.pendingAuth"),            ...sc("PENDING_AUTH") },
    ASSIGNED:                       { label: t("oolshik:status.assigned"),               ...sc("ASSIGNED") },
    WORK_DONE_PENDING_CONFIRMATION: { label: t("oolshik:status.waitingConfirmation"),    ...sc("WORK_DONE_PENDING_CONFIRMATION") },
    REVIEW_REQUIRED:                { label: t("oolshik:status.reviewRequired"),         ...sc("REVIEW_REQUIRED") },
    COMPLETED:                      { label: t("oolshik:status.completed"),              ...sc("COMPLETED") },
    CANCELLED:                      { label: t("oolshik:status.cancelled"),              ...sc("CANCELLED") },
    UNKNOWN:                        { label: t("oolshik:taskDetailScreen.unknownStatus"),...sc("UNKNOWN") },
  }

  useFocusEffect(
    useCallback(() => {
      // Skip while the hook's own mount-time bootstrap is still in flight (idle/loading) —
      // calling refresh() here too fires a second concurrent requestForegroundPermissionsAsync,
      // which races the first on fresh installs and can leave the screen stuck on "Getting your
      // location…" even after the user grants the permission.
      if (status === "ready" || status === "denied" || status === "error") {
        refresh()
      }
      return () => {
        void stop()
      }
    }, [refresh, status, stop]),
  )

  const rawStatus = current?.status
  const normalizedStatus = normalizeTaskStatus(rawStatus)
  const isPaymentEligible = rawStatus === "ASSIGNED"

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

  // Tracks the latest taskFromStore without being a dependency of the load effect below:
  // that effect calls upsertTask, which changes the store's `tasks` reference and would
  // otherwise recompute taskFromStore and re-trigger the effect on its own write, looping forever.
  const taskFromStoreRef = useRef(taskFromStore)
  useEffect(() => {
    taskFromStoreRef.current = taskFromStore
  }, [taskFromStore])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(!taskFromStoreRef.current)
      try {
        const res = await fetchTaskById(taskId)
        if (!cancelled && res.ok && res.data) {
          const nextTask = toTaskDetailTask(res.data)
          setTask(nextTask)
          if (nextTask) upsertTask(nextTask)
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
  }, [taskId, upsertTask])

  useEffect(() => {
    if (!isWaitingForTranscription(current)) return

    let cancelled = false
    let attempts = 0
    let timer: ReturnType<typeof setTimeout> | null = null
    const pollIntervalMs = Math.min(Math.max(getRemoteFlag("help_request_poll_interval_ms"), 5000), 60000)

    const poll = async () => {
      attempts += 1
      try {
        const res = await fetchTaskById(taskId)
        if (!cancelled && res.ok && res.data) {
          const nextTask = toTaskDetailTask(res.data)
          setTask(nextTask)
          if (nextTask) upsertTask(nextTask)
          if (!isWaitingForTranscription(nextTask)) return
        }
      } catch {
        // Transcription polling is best-effort; the manual refresh path remains available.
      }

      if (!cancelled && attempts < TRANSCRIPTION_POLL_MAX_ATTEMPTS) {
        timer = setTimeout(poll, pollIntervalMs)
      }
    }

    timer = setTimeout(poll, pollIntervalMs)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [current?.description, current?.id, current?.title, current?.voiceUrl, taskId, upsertTask])

  const statusChip = statusMap[normalizedStatus] ?? statusMap.PENDING

  const isRequester = isRequesterForTask(current?.requesterId, userId)
  const isHelper = isHelperForTask(current?.helperId, userId)
  const isPendingHelper = isPendingHelperForTask(current?.pendingHelperId, userId)

  // Set task Crashlytics context whenever the loaded task changes; clear on unmount.
  useEffect(() => {
    if (!current) return
    const taskRole = isRequester ? "requester" : isHelper ? "helper" : "viewer"
    setRequestContext({
      taskContext: "detail",
      taskStatus: current.status ?? undefined,
      taskRole,
      taskIdShort: String(current.id ?? "").slice(0, 8) || undefined,
      taskHasAudio: !!(current.voiceUrl),
      taskHasPayment: false,
    })
  }, [current, isRequester, isHelper])

  useEffect(() => {
    return () => {
      clearRequestContext()
    }
  }, [])

  const loadActivePayment = useCallback(async () => {
    if (!taskId || (!isRequester && !isHelper)) {
      setActivePayments([])
      return
    }

    setPaymentLoading(true)
    try {
      const res = await fetchActivePaymentRequests(taskId)
      if (res.ok && res.data) {
        setActivePayments(res.data)
        return
      }
      if (res.status === 404) {
        setActivePayments([])
        return
      }
      setActivePayments([])
    } catch {
      setActivePayments([])
    } finally {
      setPaymentLoading(false)
    }
  }, [isHelper, isRequester, taskId])

  const loadMyPaymentProfile = useCallback(async () => {
    setMyPaymentProfileLoading(true)
    try {
      const res = await OolshikApi.getMyPaymentProfile()
      if (res.ok && res.data) {
        setMyPaymentProfile(res.data)
        return
      }
      setMyPaymentProfile({ hasProfile: false })
    } catch {
      // best-effort
      setMyPaymentProfile({ hasProfile: false })
    } finally {
      setMyPaymentProfileLoading(false)
    }
  }, [])

  const refreshTask = useCallback(async () => {
    if (!taskId || refreshInFlightRef.current) return
    refreshInFlightRef.current = true
    setRefreshing(true)
    try {
      const res = await fetchTaskById(taskId)
      if (res.ok && res.data) {
        const nextTask = toTaskDetailTask(res.data)
        setTask(nextTask)
        if (nextTask) upsertTask(nextTask)
      } else {
        Alert.alert(
          t("oolshik:taskDetailScreen.refreshFailedTitle"),
          res.message || t("oolshik:taskDetailScreen.refreshFailedBody"),
        )
      }

      if (res.ok && res.data) {
        if (res.data.status === "ASSIGNED") {
          await Promise.all([loadActivePayment(), loadMyPaymentProfile()])
        } else {
          setActivePayments([])
          await loadMyPaymentProfile()
        }
      } else {
        await loadMyPaymentProfile()
      }
    } finally {
      refreshInFlightRef.current = false
      setRefreshing(false)
    }
  }, [loadActivePayment, loadMyPaymentProfile, taskId, t, upsertTask])

  useFocusEffect(
    useCallback(() => {
      void refreshTask()
    }, [refreshTask]),
  )

  const contactLabel = isRequester
    ? t("oolshik:taskDetailScreen.contactHelperPhone")
    : t("oolshik:taskDetailScreen.contactRequesterPhone")

  const hasHelper = !!current?.helperId || !!current?.pendingHelperId
  const canViewContact = isRequester
    ? !!rawStatus && rawStatus !== "OPEN" && hasHelper
    : (isHelper || isPendingHelper) && !!fullPhone

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
  const canMarkDone = current?.canMarkDone ?? (isHelper && rawStatus === "ASSIGNED")
  const canConfirmCompletion =
    current?.canConfirm ?? (isRequester && rawStatus === "WORK_DONE_PENDING_CONFIRMATION")
  const canReportIssue =
    current?.canReportIssue ?? (isRequester && rawStatus === "WORK_DONE_PENDING_CONFIRMATION")
  const canEditOffer = canEditOfferForTask(isRequester, rawStatus, current?.helperId ?? null)

  const currentOfferAmount = typeof current?.offerAmount === "number" ? current.offerAmount : null
  const currentOfferText =
    currentOfferAmount == null
      ? t("oolshik:taskDetailScreen.noOffer")
      : `₹${currentOfferAmount.toFixed(2)} ${current?.offerCurrency || "INR"}`

  const {
    msUntilReassign,
    msUntilAuthExpiry,
    reassignCountdown,
    authCountdown,
    authExpired,
    completionConfirmationCountdown,
  } = useTaskTimers({
    rawStatus,
    helperAcceptedAt: current?.helperAcceptedAt,
    pendingAuthExpiresAt: current?.pendingAuthExpiresAt,
    completionConfirmationExpiresAt: current?.completionConfirmationExpiresAt,
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
    const amount = activePayments[0]?.snapshot?.amountRequested
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return
    setHelperPaymentAmountInput((prev) => (prev.trim().length ? prev : amount.toFixed(2)))
  }, [activePayments, isHelper])

  useEffect(() => {
    if (!current?.id) {
      setActivePayments([])
      return
    }
    if (!isPaymentEligible) {
      setActivePayments([])
      return
    }
    void loadActivePayment()
  }, [current?.id, current?.updatedAt, loadActivePayment, rawStatus])

  const canReassign =
    isRequester &&
    rawStatus === "ASSIGNED" &&
    msUntilReassign === 0 &&
    (current?.reassignedCount ?? 0) < MAX_REASSIGN

  const payablePayments = useMemo(
    () =>
      activePayments.filter((payment) => {
        const statusValue = (payment.status ?? payment.snapshot?.status ?? "").toUpperCase()
        const awaitingUser = statusValue === "PENDING" || statusValue === "INITIATED"
        return !!payment.canPay && awaitingUser
      }),
    [activePayments],
  )

  const activePayment = useMemo(() => {
    if (!isPaymentEligible) return null
    if (isRequester) {
      return payablePayments[0] ?? activePayments[0] ?? null
    }
    if (isHelper) {
      return (
        activePayments.find((payment) => payment.payerRole === "REQUESTER") ??
        payablePayments[0] ??
        activePayments[0] ??
        null
      )
    }
    return activePayments[0] ?? null
  }, [activePayments, isHelper, isPaymentEligible, isRequester, payablePayments])

  const activePaymentStatus = (activePayment?.status ?? activePayment?.snapshot?.status ?? "").toUpperCase()
  const paymentAwaitingUser = activePaymentStatus === "PENDING" || activePaymentStatus === "INITIATED"
  const paymentCanAct = payablePayments.length > 0
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
                typeof res.data?.offerAmount === "number"
                  ? res.data.offerAmount
                  : parsedOffer.amount,
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

  const withPaymentNoticeGate = useCallback(
    (onContinue: () => void, intent: PaymentNoticeIntent = "pay") => {
      if (paymentNoticeDialogOpenRef.current) return
      if (hasSeenPaymentNotice(userId, intent)) {
        onContinue()
        return
      }

      const titleKey = intent === "collect" ? "payment:notice.collectTitle" : "payment:notice.title"
      const line1Key = intent === "collect" ? "payment:notice.collectLine1" : "payment:notice.line1"
      const line2Key = intent === "collect" ? "payment:notice.collectLine2" : "payment:notice.line2"

      paymentNoticeDialogOpenRef.current = true
      Alert.alert(
        t(titleKey),
        `${t(line1Key)}

${t(line2Key)}`,
        [
          {
            text: t("payment:notice.cancelCta"),
            style: "cancel",
            onPress: () => {
              paymentNoticeDialogOpenRef.current = false
            },
          },
          {
            text: t("payment:notice.primaryCta"),
            onPress: () => {
              markPaymentNoticeSeen(userId, intent)
              paymentNoticeDialogOpenRef.current = false
              InteractionManager.runAfterInteractions(onContinue)
            },
          },
        ],
        {
          cancelable: true,
          onDismiss: () => {
            paymentNoticeDialogOpenRef.current = false
          },
        },
      )
    },
    [t, userId],
  )

  const openPaymentFlow = useCallback(() => {
    if (!current || payablePayments.length === 0) return

    const navigateToPayment = (paymentRequest: PaymentRequestApiResponse) => {
      navigation.navigate("PaymentPay", {
        taskId: String(current.id),
        paymentRequestId: paymentRequest.id,
        scanPayload: buildPaymentScanPayload(paymentRequest),
        taskContext: buildPaymentTaskContext(current),
        upiIntentOverride: paymentRequest.upiIntent,
        payerRole: paymentRequest.payerRole,
        payerName: paymentRequest.payerName ?? null,
        payeeName: paymentRequest.payeeName ?? paymentRequest.snapshot?.payeeName ?? null,
        payerUserId: paymentRequest.payerUserId ?? null,
        payeeUserId: paymentRequest.payeeUserId ?? null,
      })
    }

    withPaymentNoticeGate(() => {
      if (payablePayments.length === 1) {
        navigateToPayment(payablePayments[0])
        return
      }

      Alert.alert(
        t("payment:pay.chooseOptionTitle"),
        t("payment:pay.chooseOptionBody"),
        [
          ...payablePayments.slice(0, 2).map((paymentRequest) => ({
            text: buildPaymentOptionLabel(paymentRequest),
            onPress: () => navigateToPayment(paymentRequest),
          })),
          { text: t("common:cancel"), style: "cancel" },
        ],
      )
    })
  }, [current, navigation, payablePayments, t, withPaymentNoticeGate])

  const validateHelperAmount = useCallback((): number | null => {
    const trimmed = helperPaymentAmountInput.trim()
    if (!trimmed) {
      setHelperPaymentAmountError(t("payment:qr.enterAmount"))
      return null
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setHelperPaymentAmountError(t("payment:qr.invalidAmount"))
      return null
    }

    if (parsed > 1000000) {
      setHelperPaymentAmountError(t("payment:qr.amountTooHigh"))
      return null
    }

    setHelperPaymentAmountError(null)
    return Number(parsed.toFixed(2))
  }, [helperPaymentAmountInput, t])

  const launchScanMethod = useCallback(
    (collectIntent: boolean, amount: number) => {
      if (!current?.id) return
      const requesterName = toFirstName(current.createdByName ?? t("payment:qr.requester"))

      if (collectIntent && myPaymentProfileLoading) return

      if (collectIntent && !myPaymentProfile.hasProfile) {
        InteractionManager.runAfterInteractions(() => {
          Alert.alert(
            t("payment:direct.profileRequiredTitle"),
            t("payment:direct.profileRequiredBody"),
            [
              { text: t("common:cancel"), style: "cancel" },
              {
                text: t("payment:direct.addProfileCta"),
                onPress: () =>
                  navigation.navigate("PaymentProfile", {
                    entryPoint: "task-payment",
                    required: true,
                  }),
              },
            ],
          )
        })
        return
      }

      navigation.navigate("QrScanner", {
        taskId: String(current.id),
        amount,
        expectedPayeeName: collectIntent ? (myPaymentProfile.payeeLabel ?? null) : requesterName,
        expectedPayeeVpa: null,
        expectedTaskAmount: amount,
        collectIntent,
      })
    },
    [
      current,
      myPaymentProfile.hasProfile,
      myPaymentProfile.payeeLabel,
      myPaymentProfileLoading,
      navigation,
      t,
    ],
  )

  const startDirectPayment = useCallback(
    async (payerRole: PaymentPayerRole, amount: number) => {
      if (!current?.id) return

      if (payerRole === "REQUESTER" && myPaymentProfileLoading) {
        InteractionManager.runAfterInteractions(() => {
          Alert.alert(t("payment:direct.profileLoadingTitle"), t("payment:direct.profileLoadingBody"))
        })
        return
      }

      if (payerRole === "REQUESTER" && !myPaymentProfile.hasProfile) {
        InteractionManager.runAfterInteractions(() => {
          Alert.alert(
            t("payment:direct.profileRequiredTitle"),
            t("payment:direct.profileRequiredBody"),
            [
              { text: t("common:cancel"), style: "cancel" },
              {
                text: t("payment:direct.addProfileCta"),
                onPress: () =>
                  navigation.navigate("PaymentProfile", {
                    entryPoint: "task-payment",
                    required: true,
                  }),
              },
            ],
          )
        })
        return
      }

      try {
        const response = await OolshikApi.createDirectPaymentRequest({
          taskId: String(current.id),
          amount,
          currency: "INR",
          payerRole,
        })

        if (!response.ok || !response.data) {
          const message =
            (response.data as { message?: string } | undefined)?.message ??
            t("payment:direct.createFailed")
          throw new Error(message)
        }

        const createdPayment = response.data
        if (!createdPayment) {
          throw new Error(t("payment:direct.createFailed"))
        }
        setActivePayments((prev) => mergeActivePayments(prev, createdPayment))

        if (payerRole === "HELPER") {
          navigation.navigate("PaymentPay", {
            taskId: String(current.id),
            paymentRequestId: createdPayment.id,
            scanPayload: buildPaymentScanPayload(createdPayment),
            taskContext: buildPaymentTaskContext(current),
            upiIntentOverride: createdPayment.upiIntent,
            payerRole: createdPayment.payerRole,
            payerName: createdPayment.payerName ?? null,
            payeeName: createdPayment.payeeName ?? createdPayment.snapshot?.payeeName ?? null,
            payerUserId: createdPayment.payerUserId ?? null,
            payeeUserId: createdPayment.payeeUserId ?? null,
            currentUserPaymentRole: "PAYER",
          })
          return
        }

        InteractionManager.runAfterInteractions(() => {
          Alert.alert(t("payment:direct.requestedTitle"), t("payment:direct.requestedBody"))
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : t("payment:direct.createFailed")
        const alertCopy = resolveDirectPaymentErrorCopy(payerRole, message, t)
        InteractionManager.runAfterInteractions(() => {
          if (alertCopy.showAddProfileCta) {
            Alert.alert(alertCopy.title, alertCopy.body, [
              { text: t("common:cancel"), style: "cancel" },
              {
                text: t("payment:direct.addProfileCta"),
                onPress: () =>
                  navigation.navigate("PaymentProfile", {
                    entryPoint: "task-payment",
                    required: true,
                  }),
              },
            ])
            return
          }
          Alert.alert(alertCopy.title, alertCopy.body)
        })
      }
    },
    [current, myPaymentProfile.hasProfile, myPaymentProfileLoading, navigation, t],
  )

  const choosePaymentMethod = useCallback(
    (collectIntent: boolean) => {
      if (rawStatus !== "ASSIGNED" || !current?.id) return
      const amount = validateHelperAmount()
      if (amount == null) return

      withPaymentNoticeGate(() => {
        Alert.alert(
          collectIntent ? t("payment:direct.collectMethodTitle") : t("payment:direct.payMethodTitle"),
          collectIntent ? t("payment:direct.collectMethodBody") : t("payment:direct.payMethodBody"),
          [
            {
              text: collectIntent
                ? t("payment:direct.collectScanMethod")
                : t("payment:direct.payScanMethod"),
              onPress: () => launchScanMethod(collectIntent, amount),
            },
            {
              text: collectIntent
                ? t("payment:direct.collectDirectMethod")
                : t("payment:direct.payDirectMethod"),
              onPress: () => {
                void startDirectPayment(collectIntent ? "REQUESTER" : "HELPER", amount)
              },
            },
            { text: t("common:cancel"), style: "cancel" },
          ],
        )
      }, collectIntent ? "collect" : "pay")
    },
    [current, launchScanMethod, rawStatus, startDirectPayment, t, validateHelperAmount, withPaymentNoticeGate],
  )

  const onRequestPayment = useCallback(() => choosePaymentMethod(true), [choosePaymentMethod])
  const onPayRequester = useCallback(() => choosePaymentMethod(false), [choosePaymentMethod])

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
        Alert.alert(t("errors:requestFailed"), res.message || t("oolshik:taskDetailScreen.unableShowNumber"))
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
      Alert.alert(
        t("oolshik:taskDetailScreen.infoTitle"),
        t("oolshik:taskDetailScreen.onlyHelpersCanAccept"),
      )
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

    Alert.alert(
      t("oolshik:taskDetailScreen.acceptErrorTitle"),
      t("oolshik:taskDetailScreen.acceptErrorBody"),
    )
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
          setTask((prev) =>
            prev ? { ...prev, status: "ASSIGNED", pendingAuthExpiresAt: null } : prev,
          )
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

  const onMarkDone = useCallback(() => {
    if (!current?.id) return
    if (!canMarkDone) {
      Alert.alert(t("oolshik:taskDetailScreen.markDoneNotAllowedTitle"), t("oolshik:taskDetailScreen.markDoneNotAllowed"))
      return
    }
    setMarkDoneConfirmVisible(true)
  }, [canMarkDone, current?.id, t])

  const closeMarkDoneConfirm = useCallback(() => {
    if (actionLoading) return
    setMarkDoneConfirmVisible(false)
  }, [actionLoading])

  const confirmMarkDone = useCallback(async () => {
    if (!current?.id || actionLoading) return

    setMarkDoneConfirmVisible(false)
    setActionLoading(true)
    try {
      const res = await markTaskDone(String(current.id))
      if (!res.ok) throw new Error("mark-done-failed")
      if (res.data) {
        setTask((prev) => (prev ? { ...prev, ...res.data } : (res.data as TaskDetailTask)))
      }
      setRecoveryNotice(t("oolshik:taskDetailScreen.waitingForConfirmationNotice"))
    } catch {
      Alert.alert(t("oolshik:taskDetailScreen.markDoneFailedTitle"), t("oolshik:taskDetailScreen.markDoneFailed"))
    } finally {
      setActionKind(null)
      setActionLoading(false)
    }
  }, [actionLoading, current?.id, t])

  const onComplete = useCallback(() => {
    if (!current?.id || actionLoading) return
    setConfirmCompletionDialogVisible(true)
  }, [actionLoading, current?.id])

  const closeConfirmCompletionDialog = useCallback(() => {
    if (actionLoading) return
    setConfirmCompletionDialogVisible(false)
  }, [actionLoading])

  const doConfirmCompletion = useCallback(async () => {
    if (!current?.id || actionLoading) return

    setConfirmCompletionDialogVisible(false)
    const nextActionKind =
      rawStatus === "WORK_DONE_PENDING_CONFIRMATION" ? "confirmCompletion" : "completeTask"

    setActionKind(nextActionKind)
    setActionLoading(true)
    try {
      const res =
        rawStatus === "WORK_DONE_PENDING_CONFIRMATION"
          ? await confirmTaskCompletion(String(current.id))
          : await completeTask(String(current.id))

      if (res.ok) {
        if (res.data) {
          setTask((prev) => (prev ? { ...prev, ...res.data } : (res.data as TaskDetailTask)))
        } else {
          setTask((prev) => (prev ? { ...prev, status: "COMPLETED" } : prev))
        }
        fetchActiveSummary().catch(() => {})

        const completedTaskId = String(current.id)
        logEvent(AnalyticsEvent.HELP_REQUEST_COMPLETED, { taskId: completedTaskId })

        if (!hasShownFeedbackPrompt(completedTaskId, "completion")) {
          markFeedbackPromptShown(completedTaskId, "completion")
          logEvent(AnalyticsEvent.FEEDBACK_PROMPT_SHOWN, { event: "completion", taskId: completedTaskId })
          Alert.alert(
            t("oolshik:feedback.completionPromptTitle"),
            t("oolshik:feedback.completionPromptBody"),
            [
              {
                text: t("oolshik:feedback.promptSkip"),
                style: "cancel",
                onPress: () => {
                  logEvent(AnalyticsEvent.FEEDBACK_PROMPT_SKIPPED, {
                    event: "completion",
                    taskId: completedTaskId,
                  })
                  if (!hasSeenFeedbackLaterAlert(userId)) {
                    markFeedbackLaterAlertSeen(userId)
                    logEvent(AnalyticsEvent.FEEDBACK_LATER_ALERT_SHOWN, {
                      event: "completion",
                      taskId: completedTaskId,
                    })
                    Alert.alert(
                      t("oolshik:feedback.laterAlertTitle"),
                      t("oolshik:feedback.laterAlertBody"),
                    )
                  }
                },
              },
              {
                text: t("oolshik:feedback.promptGiveFeedback"),
                onPress: () =>
                  navigation.navigate("OolshikFeedbackRating", {
                    taskId: completedTaskId,
                    promptEvent: "completion",
                  }),
              },
            ],
          )
        }
        return
      }

      if (rawStatus === "WORK_DONE_PENDING_CONFIRMATION") {
        Alert.alert(t("oolshik:taskDetailScreen.confirmCompletionFailedTitle"), t("oolshik:taskDetailScreen.confirmCompletionFailed"))
        return
      }

      if (
        res.status === 403 ||
        res.status === 409 ||
        String(res.data || "").includes("Only requester can complete")
      ) {
        Alert.alert(t("oolshik:taskDetailScreen.onlyRequesterCanCompleteTitle"), t("oolshik:taskDetailScreen.onlyRequesterCanComplete"))
        return
      }

      Alert.alert(t("oolshik:taskDetailScreen.errorCompletingTask"))
    } finally {
      setActionKind(null)
      setActionLoading(false)
    }
  }, [actionLoading, current?.id, fetchActiveSummary, navigation, rawStatus, t, userId])

  const onSubmitRating = useCallback(async () => {
    if (!current?.id) return
    if (!isRequester && !isHelper) return
    if (myRating != null) return

    setRatingSubmitting(true)
    try {
      const cleanRating = normalizeRating(rating, { min: 0, max: 5, step: 0.5 })
      const res = await rateTask(String(current.id), {
        rating: cleanRating,
        feedback: undefined,
      })

      if (!res.ok) {
        throw new Error("rating-failed")
      }

      setTask((prev) =>
        prev
          ? {
              ...prev,
              ratingByRequester: isRequester ? cleanRating : prev.ratingByRequester,
              ratingByHelper: isHelper ? cleanRating : prev.ratingByHelper,
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
    if (!current?.id || !reasonModal.action) return

    if (!reasonModal.reasonCode) {
      Alert.alert(
        t("oolshik:taskDetailScreen.selectReasonTitle"),
        t("oolshik:taskDetailScreen.selectReasonBody"),
      )
      return
    }

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
        fetchActiveSummary().catch(() => {})
      } else if (reasonModal.action === "release") {
        const res = await releaseTask(String(current.id), payload)
        if (!res.ok) throw new Error("release-failed")
        setTask((prev) => (prev ? { ...prev, status: "OPEN", helperId: null } : prev))
        setActivePayments([])
        setHelperPaymentAmountInput("")
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
      } else if (reasonModal.action === "issue") {
        const res = await reportTaskIssue(String(current.id), payload)
        if (!res.ok) throw new Error("issue-failed")
        if (res.data) {
          setTask((prev) => (prev ? { ...prev, ...res.data } : (res.data as TaskDetailTask)))
        } else {
          setTask((prev) => (prev ? { ...prev, status: "REVIEW_REQUIRED" } : prev))
        }
        setRecoveryNotice(t("oolshik:taskDetailScreen.issueReportedNotice"))
      } else if (reasonModal.action === "reassign") {
        const res = await reassignTask(String(current.id), payload)
        if (!res.ok) throw new Error("reassign-failed")
        setTask((prev) => (prev ? { ...prev, status: "OPEN", helperId: null } : prev))
        setRecoveryNotice(t("oolshik:taskDetailScreen.requestReopenedNotice"))
      }

      if (coords && status === "ready") {
        await fetchNearby(coords.latitude, coords.longitude)
      }
      closeReasonSheet()
    } catch {
      Alert.alert(
        t("oolshik:taskDetailScreen.actionFailedTitle"),
        t("oolshik:taskDetailScreen.actionFailedBody"),
      )
    } finally {
      setActionLoading(false)
    }
  }, [
    closeReasonSheet,
    coords,
    current?.id,
    fetchNearby,
    fetchActiveSummary,
    reasonModal.action,
    reasonModal.reasonCode,
    reasonModal.reasonText,
    status,
    t,
  ])

  const showNoMapsAlert = useCallback(
    (lat: number, lon: number) => {
      Alert.alert(
        t("oolshik:taskDetailScreen.noMapsTitle"),
        t("oolshik:taskDetailScreen.noMapsBody", { lat, lon }),
      )
    },
    [t],
  )

  const launchProviderSafely = useCallback(
    async (id: MapProviderId, lat: number, lon: number, label: string) => {
      try {
        await launchMapProvider(id, lat, lon, label)
      } catch (err) {
        breadcrumb(`task:open_map_failed error=${err instanceof Error ? err.message : String(err)}`)
        showNoMapsAlert(lat, lon)
      }
    },
    [showNoMapsAlert],
  )

  const openInMaps = useCallback(
    async (
      lat: number | null | undefined,
      lon: number | null | undefined,
      label = "Task",
    ) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        Alert.alert(
          t("oolshik:taskDetailScreen.locationUnavailableTitle"),
          t("oolshik:taskDetailScreen.locationUnavailableBody"),
        )
        return
      }

      const safeLat = lat as number
      const safeLon = lon as number
      const options = await getAvailableMapProviders()

      if (options.length === 0) {
        // Nothing detected as installed — try Google Maps anyway, it falls
        // back to the web URL internally if the app isn't there.
        await launchProviderSafely("googleMaps", safeLat, safeLon, label)
        return
      }

      if (options.length === 1) {
        await launchProviderSafely(options[0].id, safeLat, safeLon, label)
        return
      }

      setMapChooser({ visible: true, lat: safeLat, lon: safeLon, label, options })
    },
    [t, launchProviderSafely],
  )

  const selectMapProvider = useCallback(
    (id: MapProviderId) => {
      setMapChooser((prev) => ({ ...prev, visible: false }))
      void launchProviderSafely(id, mapChooser.lat, mapChooser.lon, mapChooser.label)
    },
    [launchProviderSafely, mapChooser.lat, mapChooser.lon, mapChooser.label],
  )

  const closeMapChooser = useCallback(() => {
    setMapChooser((prev) => ({ ...prev, visible: false }))
  }, [])

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
      {
        code: "FOUND_ALTERNATIVE",
        label: t("oolshik:taskDetailScreen.cancelReasonFoundAlternative"),
      },
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

  const issueReasons = useMemo(
    () => [
      { code: "NOT_DONE", label: t("oolshik:taskDetailScreen.issueReasonNotDone") },
      { code: "PARTIALLY_DONE", label: t("oolshik:taskDetailScreen.issueReasonPartiallyDone") },
      { code: "QUALITY_ISSUE", label: t("oolshik:taskDetailScreen.issueReasonQuality") },
      { code: "OTHER", label: t("oolshik:taskDetailScreen.reasonOther") },
    ],
    [t],
  )

  const reassignReasons = useMemo(
    () => [
      {
        code: "HELPER_NOT_RESPONDING",
        label: t("oolshik:taskDetailScreen.reassignReasonNotResponding"),
      },
      { code: "TAKING_TOO_LONG", label: t("oolshik:taskDetailScreen.reassignReasonTakingTooLong") },
      { code: "CHANGED_MIND", label: t("oolshik:taskDetailScreen.reassignReasonChangedMind") },
      { code: "OTHER", label: t("oolshik:taskDetailScreen.reasonOther") },
    ],
    [t],
  )

  const currentReasons =
    reasonModal.action === "release"
      ? releaseReasons
      : reasonModal.action === "reject"
        ? rejectReasons
        : reasonModal.action === "issue"
          ? issueReasons
          : reasonModal.action === "reassign"
            ? reassignReasons
        : cancelReasons

  const ratingBadgeValue = normalizedStatus === "COMPLETED" ? otherPartyRating : oppositeAvgRating
  const showRatingBadge = ratingBadgeValue != null
  const canRate = current?.canRate ?? (normalizedStatus === "COMPLETED" && (isRequester || isHelper))
  const distanceLabel = formatDistance(current?.distanceMtr, t)

  const paymentAmountText =
    typeof activePayment?.snapshot?.amountRequested === "number"
      ? t("oolshik:taskDetailScreen.amountValue", {
          amount: activePayment.snapshot.amountRequested.toFixed(2),
        })
      : null

  function buildPaymentTaskContext(task: TaskDetailTask): PaymentTaskContext {
    return {
      id: String(task.id),
      title: task.title ?? task.description ?? null,
      createdByName: task.createdByName ?? null,
      createdByPhoneNumber: task.createdByPhoneNumber ? String(task.createdByPhoneNumber) : null,
      helperName: task.helperName ?? null,
    }
  }

  function buildPaymentScanPayload(paymentRequest: PaymentRequestApiResponse): PaymentScanPayload {
    return {
      rawPayload: paymentRequest.upiIntent ?? "",
      format: "upi-uri",
      payeeVpa:
        paymentRequest.snapshot?.payeeMaskedVpa ??
        paymentRequest.snapshot?.payeeVpa ??
        null,
      payeeName: paymentRequest.snapshot?.payeeName ?? null,
      txnRef: paymentRequest.snapshot?.txnRef ?? null,
      mcc: paymentRequest.snapshot?.mcc ?? null,
      merchantId: paymentRequest.snapshot?.merchantId ?? null,
      amount:
        typeof paymentRequest.snapshot?.amountRequested === "number"
          ? paymentRequest.snapshot.amountRequested
          : null,
      currency: paymentRequest.snapshot?.currency ?? "INR",
      note: paymentRequest.snapshot?.note ?? null,
      scanLocation: null,
      scannedAt: paymentRequest.snapshot?.createdAt ?? new Date().toISOString(),
      guidelines: [
        t("oolshik:taskDetailScreen.verifyRecipientGuideline"),
        t("oolshik:taskDetailScreen.markPaidGuideline"),
      ],
    }
  }

  function buildPaymentOptionLabel(paymentRequest: PaymentRequestApiResponse) {
    const amount =
      typeof paymentRequest.snapshot?.amountRequested === "number"
        ? ` • ₹${paymentRequest.snapshot.amountRequested.toFixed(2)}`
        : ""
    const modeLabel =
      paymentRequest.paymentMode === "MERCHANT_QR"
        ? t("payment:pay.optionMerchant")
        : paymentRequest.paymentMode === "PAY_REQUESTER_DIRECT"
          ? t("payment:pay.optionDirectToRequester")
          : t("payment:pay.optionDirectToHelper")
    return `${modeLabel}${amount}`
  }

  function mergeActivePayments(
    currentPayments: PaymentRequestApiResponse[],
    nextPayment: PaymentRequestApiResponse,
  ) {
    const remaining = currentPayments.filter((payment) => payment.id !== nextPayment.id)
    return [nextPayment, ...remaining]
  }

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
      actionKind,
      ratingSubmitting,
      recoveryNotice,
      authDecision,
      markDoneConfirmVisible,
      confirmCompletionDialogVisible,
      csatRating,
      csatTag,
      csatSubmitting,
      csatSubmitted,
      submittedCsat,
      isRevealed,
      revealLoading,
      reasonModal,
      mapChooser,
      activePayment,
      activePayments,
      paymentLoading,
      myPaymentProfileLoading,
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
      completionConfirmationCountdown,
      reassignCountdown,
      canReassign,
      canCancel,
      canRelease,
      canMarkDone,
      canConfirmCompletion,
      canReportIssue,
    },
    contact: {
      contactLabel,
      canViewContact,
      displayPhone:
        isRevealed && fullPhone ? String(fullPhone) : maskPhoneNumber(fullPhone || "•••••••••••••"),
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
      description: getTaskDisplayText(current, t("oolshik:taskDetailScreen.voiceTask")),
      requesterName: current?.createdByName || t("oolshik:taskDetailScreen.requesterFallback"),
      distanceLabel,
      distanceAwayText: t("oolshik:taskCard.distanceAway", { distance: distanceLabel ?? "" }),
      canOpenMap: typeof current?.latitude === "number" && typeof current?.longitude === "number",
      reassignLimitReached: (current?.reassignedCount ?? 0) >= MAX_REASSIGN,
      paymentRequesterNotified:
        isHelper && activePayments.some((payment) => payment.payerRole === "REQUESTER"),
      tagStrings: tags,
      ratingTexts: {
        youRated:
          myRating != null
            ? t("oolshik:taskDetailScreen.youRated", { rating: myRating.toFixed(1) })
            : "",
        helperRatedYou:
          otherPartyRating != null
            ? t("oolshik:taskDetailScreen.helperRatedYou", { rating: otherPartyRating.toFixed(1) })
            : "",
        requesterRatedYou:
          otherPartyRating != null
            ? t("oolshik:taskDetailScreen.requesterRatedYou", {
                rating: otherPartyRating.toFixed(1),
              })
            : "",
        ratingSubmittedValue:
          submittedCsat?.rating != null
            ? t("oolshik:taskDetailScreen.ratingSubmittedValue", { rating: submittedCsat.rating })
            : undefined,
        tagSubmitted: submittedCsat?.tags?.length
          ? t("oolshik:taskDetailScreen.tagLabel", { tag: submittedCsat.tags.join(", ") })
          : undefined,
        commentSubmitted: submittedCsat?.message
          ? t("oolshik:taskDetailScreen.commentLabel", { comment: submittedCsat.message })
          : undefined,
      },
    },
    reasons: {
      currentReasons,
      cancelReasons,
      releaseReasons,
      rejectReasons,
      issueReasons,
      reassignReasons,
      confirmDisabled:
        !reasonModal.reasonCode ||
        (reasonModal.reasonCode === "OTHER" && !reasonModal.reasonText?.trim()),
    },
    handlers: {
      refreshTask,
      setOfferInput,
      onSaveOffer,
      onRevealPhone,
      onCall,
      togglePlay: toggle,
      openMap: () => openInMaps(current?.latitude, current?.longitude),
      selectMapProvider,
      closeMapChooser,
      onAccept,
      onAuthorize,
      onMarkDone,
      closeMarkDoneConfirm,
      confirmMarkDone,
      onComplete,
      closeConfirmCompletionDialog,
      doConfirmCompletion,
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
      openPaymentFlow,
      onRequestPayment,
      onPayRequester,
      loadActivePayment,
      onHelperPaymentAmountChange: (value: string) => {
        setHelperPaymentAmountInput(sanitizePaymentAmountInput(value))
        if (helperPaymentAmountError) setHelperPaymentAmountError(null)
      },
      setCsatRating,
      toggleCsatTag: (tag: string) => setCsatTag((prev) => (prev === tag ? null : tag)),
      renderLocationState,
      goBack: () => navigation.goBack(),
      openReport: () => {
        breadcrumb(`task:report_opened id=${String(current?.id ?? "").slice(0, 8)}`)
        navigation.navigate("OolshikReport", { taskId: current?.id })
      },
    },
  }
}
