import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Alert, Linking, StyleSheet, View, ViewStyle } from "react-native"
import type {
  OolshikStackScreenProps,
  PaymentScanPayload,
  PaymentTaskContext,
} from "@/navigators/OolshikNavigator"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import type { Theme } from "@/theme/types"
import { OolshikApi } from "@/api/client"

type PaymentBreakdownItem = {
  label: string
  amount: number
  hint?: string
}

type PaymentHighlight = {
  label: string
  value: string
}

type PaymentSnapshot = {
  id?: string
  payeeName?: string | null
  payeeVpa?: string | null
  amountRequested?: number | null
  note?: string | null
  dueDate?: string | null
  status?: string | null
  lastUpdated?: string | null
  contactNumber?: string | null
  paymentWindow?: string | null
  breakdown?: PaymentBreakdownItem[]
  highlights?: PaymentHighlight[]
  disclaimers?: string[]
}

type PaymentRequestPayload = {
  upiIntent?: string
  supportLink?: string
  snapshot: PaymentSnapshot
}

type BuildSeedArgs = {
  paymentRequestId?: string
  scanPayload: PaymentScanPayload
  taskContext?: PaymentTaskContext
}

const DEFAULT_STATUS = "Awaiting payment"

const ensureStringArray = (list?: string[] | null) => (list && list.length ? [...list] : undefined)

const mergeHighlights = (a?: PaymentHighlight[], b?: PaymentHighlight[]) => {
  const combined = [...(a ?? []), ...(b ?? [])]
  const seen = new Set<string>()
  const result: PaymentHighlight[] = []
  combined.forEach((item) => {
    if (!item?.label && !item?.value) return
    const key = `${item.label ?? ""}|${item.value ?? ""}`
    if (!seen.has(key)) {
      seen.add(key)
      result.push(item)
    }
  })
  return result.length ? result : undefined
}

const buildSeedPayment = ({ paymentRequestId, scanPayload, taskContext }: BuildSeedArgs) => {
  const amount =
    typeof scanPayload.amount === "number" && !Number.isNaN(scanPayload.amount)
      ? scanPayload.amount
      : null

  const highlights: PaymentHighlight[] = []
  if (taskContext?.title) {
    highlights.push({ label: "Task", value: taskContext.title })
  }
  if (taskContext?.createdByName) {
    highlights.push({ label: "Requester", value: taskContext.createdByName })
  }

  const snapshot: PaymentSnapshot = {
    id: paymentRequestId,
    payeeName: scanPayload.payeeName ?? taskContext?.createdByName ?? null,
    payeeVpa: scanPayload.payeeVpa ?? null,
    amountRequested: amount,
    note: scanPayload.note ?? null,
    status: DEFAULT_STATUS,
    lastUpdated: scanPayload.scannedAt ?? null,
    contactNumber: taskContext?.createdByPhoneNumber ?? null,
    paymentWindow: null,
    breakdown: [],
    highlights: highlights.length ? highlights : undefined,
    disclaimers: ensureStringArray(scanPayload.guidelines),
  }

  return {
    upiIntent:
      scanPayload.format === "upi-uri" || scanPayload.rawPayload.startsWith("upi://")
        ? scanPayload.rawPayload
        : undefined,
    supportLink: undefined,
    snapshot,
  }
}

const mergePaymentPayload = (
  base: PaymentRequestPayload | null,
  next: PaymentRequestPayload | null,
): PaymentRequestPayload | null => {
  if (!base) return next
  if (!next) return base

  const mergedSnapshot: PaymentSnapshot = {
    ...base.snapshot,
    ...next.snapshot,
  }

  mergedSnapshot.amountRequested =
    next.snapshot.amountRequested ?? base.snapshot.amountRequested ?? null
  mergedSnapshot.payeeName = next.snapshot.payeeName ?? base.snapshot.payeeName ?? null
  mergedSnapshot.payeeVpa = next.snapshot.payeeVpa ?? base.snapshot.payeeVpa ?? null
  mergedSnapshot.note = next.snapshot.note ?? base.snapshot.note ?? null
  mergedSnapshot.status = next.snapshot.status ?? base.snapshot.status ?? DEFAULT_STATUS
  mergedSnapshot.lastUpdated = next.snapshot.lastUpdated ?? base.snapshot.lastUpdated ?? null
  mergedSnapshot.contactNumber = next.snapshot.contactNumber ?? base.snapshot.contactNumber ?? null
  mergedSnapshot.paymentWindow = next.snapshot.paymentWindow ?? base.snapshot.paymentWindow ?? null
  mergedSnapshot.breakdown = next.snapshot.breakdown ?? base.snapshot.breakdown
  mergedSnapshot.highlights = mergeHighlights(base.snapshot.highlights, next.snapshot.highlights)
  const disclaimers = next.snapshot.disclaimers ?? base.snapshot.disclaimers
  mergedSnapshot.disclaimers = ensureStringArray(disclaimers)

  return {
    upiIntent: next.upiIntent ?? base.upiIntent,
    supportLink: next.supportLink ?? base.supportLink,
    snapshot: mergedSnapshot,
  }
}

interface PaymentPayScreenProps extends OolshikStackScreenProps<"PaymentPay"> {}

export const PaymentPayScreen: React.FC<PaymentPayScreenProps> = ({ route }) => {
  const { taskId, paymentRequestId, scanPayload, taskContext } = route.params
  const { theme } = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])

  const seedPayment = useMemo(
    () => buildSeedPayment({ paymentRequestId, scanPayload, taskContext }),
    [paymentRequestId, scanPayload, taskContext],
  )

  const [payment, setPayment] = useState<PaymentRequestPayload | null>(seedPayment)
  const [loading, setLoading] = useState<boolean>(Boolean(paymentRequestId))
  const [error, setError] = useState<string | null>(null)
  const [isLaunchingPayment, setIsLaunchingPayment] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const requestIdRef = useRef(0)

  const loadPayment = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setError(null)
    if (!paymentRequestId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const response = await OolshikApi.getPaymentRequest(paymentRequestId)
      if (requestId !== requestIdRef.current) return
      const normalized = normalizePaymentResponse(response)
      if (!normalized) throw new Error("Payment snapshot missing")
      setPayment((prev) => mergePaymentPayload(prev ?? seedPayment, normalized))
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setError(extractErrorMessage(err))
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [paymentRequestId, seedPayment])

  useEffect(() => {
    loadPayment()
    return () => {
      requestIdRef.current += 1
    }
  }, [loadPayment])

  const handleRetry = useCallback(() => {
    loadPayment()
  }, [loadPayment])

  const handleLaunchUpi = useCallback(async () => {
    const upiIntent = payment?.upiIntent ?? seedPayment?.upiIntent
    if (!upiIntent) {
      Alert.alert("Unavailable", "We couldn't find a UPI link for this request.")
      return
    }
    setIsLaunchingPayment(true)
    try {
      const identifier =
        paymentRequestId ?? payment?.snapshot.id ?? seedPayment?.snapshot.id ?? taskId
      if (identifier) {
        await OolshikApi.initiatePayment(identifier)
      }
      const isSupported = await Linking.canOpenURL(upiIntent)
      if (!isSupported) {
        Alert.alert(
          "No UPI app found",
          "Install any UPI compatible app to continue or copy the link:\n\n" + upiIntent,
        )
        return
      }
      await Linking.openURL(upiIntent)
    } catch (err) {
      Alert.alert("Failed to start payment", extractErrorMessage(err))
    } finally {
      setIsLaunchingPayment(false)
    }
  }, [payment, paymentRequestId, seedPayment])

  const handleMarkPaid = useCallback(async () => {
    const identifier =
      paymentRequestId ?? payment?.snapshot.id ?? seedPayment?.snapshot.id ?? taskId
    if (!identifier) {
      Alert.alert("Unavailable", "We don't have a payment request reference yet.")
      return
    }
    setIsConfirming(true)
    try {
      await OolshikApi.markPaid(identifier, {})
      Alert.alert("Thanks!", "We'll mark this request as paid.")
    } catch (err) {
      Alert.alert("Unable to mark as paid", extractErrorMessage(err))
    } finally {
      setIsConfirming(false)
    }
  }, [payment, paymentRequestId, seedPayment])

  const handleSupportPress = useCallback(async () => {
    const supportLink = payment?.supportLink ?? seedPayment?.supportLink
    if (!supportLink) return
    try {
      const supported = await Linking.canOpenURL(supportLink)
      if (!supported) {
        Alert.alert(
          "Unable to open support link",
          "Copy and open this link manually:\n\n" + supportLink,
        )
        return
      }
      await Linking.openURL(supportLink)
    } catch (err) {
      Alert.alert("Unable to open support", extractErrorMessage(err))
    }
  }, [payment, seedPayment])

  if (loading && !payment) {
    return (
      <Screen style={$root} preset="fixed">
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.colors.palette.primary500} />
          <Text style={styles.loadingText} text="Preparing payment summary…" />
        </View>
      </Screen>
    )
  }

  if (error && !payment) {
    return (
      <Screen style={$root} preset="fixed">
        <View style={styles.fallbackState}>
          <Text preset="heading" style={styles.fallbackTitle} text="Payment not ready" />
          <Text style={styles.fallbackMessage}>{error}</Text>
          <Button
            text="Try again"
            onPress={handleRetry}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />
        </View>
      </Screen>
    )
  }

  if (!payment?.snapshot) {
    return (
      <Screen style={$root} preset="fixed">
        <View style={styles.fallbackState}>
          <Text preset="heading" style={styles.fallbackTitle} text="Missing payment details" />
          <Text style={styles.fallbackMessage}>
            We couldn't find the payment request for this task.
          </Text>
          <Button
            text="Reload"
            onPress={handleRetry}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />
        </View>
      </Screen>
    )
  }

  const snapshot = payment.snapshot
  const amountDisplay = formatCurrency(snapshot.amountRequested)
  const dueDisplay = formatDate(snapshot.dueDate, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const updatedDisplay = formatDate(snapshot.lastUpdated ?? scanPayload.scannedAt)
  const breakdown = snapshot.breakdown ?? []
  const highlights = snapshot.highlights ?? []
  const disclaimers = snapshot.disclaimers ?? scanPayload.guidelines ?? []
  const breakdownTotal = breakdown.reduce((sum, item) => sum + (item.amount ?? 0), 0)
  const inlineError = error && payment ? error : null
  const supportLink = payment?.supportLink ?? seedPayment?.supportLink

  return (
    <Screen style={$root} preset="scroll" contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel} text="Transfer amount" />
        <Text style={styles.heroAmount} text={amountDisplay} />
        <View style={styles.heroMetaRow}>
          <View style={styles.heroChip}>
            <Text
              style={styles.heroChipText}
              text={(snapshot.status ?? DEFAULT_STATUS).toUpperCase()}
            />
          </View>
          {dueDisplay ? <Text style={styles.heroMetaText} text={`Due ${dueDisplay}`} /> : null}
        </View>
        {snapshot.note ? <Text style={styles.heroNote}>{snapshot.note}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle} text="Payee details" />
        <View style={styles.row}>
          <Text style={styles.rowLabel} text="Recipient" />
          <Text style={styles.rowValue} numberOfLines={1} text={snapshot.payeeName ?? "—"} />
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel} text="UPI ID" />
          <Text
            style={[styles.rowValue, styles.monoValue]}
            numberOfLines={1}
            text={snapshot.payeeVpa ?? "—"}
          />
        </View>
        {snapshot.paymentWindow ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel} text="Payment window" />
            <Text style={styles.rowValue} numberOfLines={2} text={snapshot.paymentWindow} />
          </View>
        ) : null}
        {snapshot.contactNumber ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel} text="Contact" />
            <Text
              style={styles.rowValue}
              numberOfLines={1}
              text={snapshot.contactNumber ?? undefined}
            />
          </View>
        ) : null}
        {snapshot.id ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel} text="Request ID" />
            <Text style={styles.rowValue} numberOfLines={1} text={snapshot.id} />
          </View>
        ) : null}
        {highlights.length ? (
          <View style={styles.highlightsWrap}>
            {highlights.map((item) => (
              <View style={styles.highlightPill} key={`${item.label}-${item.value}`}>
                <Text style={styles.highlightLabel} text={item.label} />
                <Text style={styles.highlightValue} text={item.value} />
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {breakdown.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle} text="Breakdown" />
          {breakdown.map((item) => (
            <View style={styles.row} key={item.label}>
              <Text style={styles.rowLabel} text={item.label} />
              <Text style={styles.rowValue} text={formatCurrency(item.amount)} />
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel} text="Total payable" />
            <Text style={[styles.rowValue, styles.totalValue]} text={amountDisplay} />
          </View>
          {breakdownTotal && breakdownTotal !== snapshot.amountRequested ? (
            <Text style={styles.breakdownHint}>
              Totals differ from requested amount because of manual adjustments.
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle} text="Take action" />
        <Text style={styles.cardSupport}>
          Use your preferred UPI app to complete the transfer and return to Oolshik to confirm.
        </Text>
        {loading && paymentRequestId ? (
          <Text style={styles.statusText}>Refreshing payment request…</Text>
        ) : null}
        {inlineError ? <Text style={styles.errorText}>{inlineError}</Text> : null}
        <View style={styles.actions}>
          <Button
            text={isLaunchingPayment ? "Opening UPI…" : "Pay with UPI"}
            onPress={handleLaunchUpi}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
            disabled={isLaunchingPayment}
          />
          <Button
            text={isConfirming ? "Marking…" : "Mark paid already"}
            onPress={handleMarkPaid}
            style={styles.secondaryButton}
            textStyle={styles.secondaryButtonText}
            disabled={isConfirming}
          />
        </View>
      </View>

      {disclaimers.length ? (
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle} text="Before you mark as paid" />
          {disclaimers.map((line, index) => (
            <View style={styles.bulletRow} key={`${index}-${line}`}>
              <View style={styles.bullet} />
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {supportLink ? (
        <Text style={styles.supportLink} onPress={handleSupportPress}>
          Need help? Contact support
        </Text>
      ) : null}

      {updatedDisplay ? (
        <Text style={styles.updatedText} text={`Last updated ${updatedDisplay}`} />
      ) : null}
    </Screen>
  )
}

const $root: ViewStyle = {
  flex: 1,
}

const formatCurrency = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "—"
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const formatDate = (value?: string | null, overrides?: Intl.DateTimeFormatOptions) => {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    ...overrides,
  }).format(date)
}

const normalizePaymentResponse = (response: any): PaymentRequestPayload | null => {
  if (!response) return null
  const candidate = response?.snapshot
    ? response
    : response?.data?.snapshot
      ? response.data
      : (response?.data ?? null)
  if (!candidate?.snapshot) return null
  const snapshotData = candidate.snapshot ?? {}
  const highlights = Array.isArray(snapshotData.highlights) ? snapshotData.highlights : undefined
  const disclaimers = Array.isArray(snapshotData.disclaimers)
    ? snapshotData.disclaimers
    : Array.isArray(candidate.snapshot?.guidelines)
      ? candidate.snapshot.guidelines
      : undefined

  return {
    upiIntent: candidate.upiIntent ?? response?.upiIntent ?? response?.data?.upiIntent,
    supportLink: candidate.supportLink ?? response?.supportLink ?? response?.data?.supportLink,
    snapshot: {
      ...snapshotData,
      highlights,
      disclaimers: ensureStringArray(disclaimers),
    },
  }
}

const extractErrorMessage = (err: unknown) => {
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  if (err && typeof err === "object") {
    const message =
      (err as any)?.response?.data?.message ?? (err as any)?.data?.message ?? (err as any)?.message
    if (typeof message === "string") return message
  }
  return "Something went wrong while loading the payment details."
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    hero: {
      backgroundColor: theme.colors.palette.primary500,
      borderRadius: 24,
      padding: theme.spacing.xl,
      gap: theme.spacing.xs,
      shadowColor: theme.isDark ? "#00000080" : "#00000040",
      shadowOpacity: theme.isDark ? 0.25 : 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    heroLabel: {
      color: theme.colors.palette.neutral200,
      fontSize: 14,
      opacity: 0.9,
      fontFamily: theme.typography.primary.medium,
    },
    heroAmount: {
      color: theme.colors.palette.neutral100,
      fontSize: 34,
      lineHeight: 40,
      fontFamily: theme.typography.primary.bold,
    },
    heroMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    heroChip: {
      paddingHorizontal: theme.spacing.xs,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    heroChipText: {
      color: theme.colors.palette.neutral100,
      fontSize: 12,
      letterSpacing: 0.5,
      fontFamily: theme.typography.primary.medium,
    },
    heroMetaText: {
      color: theme.colors.palette.neutral100,
      fontSize: 14,
      opacity: 0.85,
      fontFamily: theme.typography.primary.normal,
    },
    heroNote: {
      marginTop: theme.spacing.sm,
      color: theme.colors.palette.neutral100,
      fontSize: 16,
      lineHeight: 22,
      fontFamily: theme.typography.primary.normal,
    },
    card: {
      backgroundColor: theme.isDark
        ? theme.colors.palette.neutral800
        : theme.colors.palette.neutral100,
      borderRadius: 20,
      padding: theme.spacing.lg,
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.isDark ? theme.colors.palette.neutral700 : theme.colors.palette.neutral200,
    },
    cardTitle: {
      fontSize: 18,
      fontFamily: theme.typography.primary.medium,
      marginBottom: theme.spacing.xs,
      color: theme.colors.text,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xs / 2,
    },
    rowLabel: {
      fontSize: 14,
      color: theme.colors.textDim,
      fontFamily: theme.typography.primary.normal,
      flexShrink: 1,
    },
    rowValue: {
      fontSize: 16,
      color: theme.colors.text,
      fontFamily: theme.typography.primary.medium,
      flexShrink: 0,
    },
    monoValue: {
      fontFamily: theme.typography.code?.normal ?? theme.typography.primary.medium,
    },
    totalValue: {
      fontFamily: theme.typography.primary.bold,
      color: theme.colors.palette.primary500,
    },
    divider: {
      height: 1,
      backgroundColor: theme.colors.palette.overlay20,
      marginVertical: theme.spacing.xs,
    },
    breakdownHint: {
      marginTop: theme.spacing.xs,
      fontSize: 12,
      color: theme.colors.textDim,
      fontFamily: theme.typography.primary.normal,
    },
    highlightsWrap: {
      marginTop: theme.spacing.sm,
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.xs,
    },
    highlightPill: {
      borderRadius: 999,
      paddingVertical: 6,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : theme.colors.palette.accent100,
    },
    highlightLabel: {
      fontSize: 11,
      opacity: 0.7,
      color: theme.colors.textDim,
      fontFamily: theme.typography.primary.medium,
    },
    highlightValue: {
      fontSize: 13,
      color: theme.colors.text,
      fontFamily: theme.typography.primary.medium,
    },
    cardSupport: {
      fontSize: 14,
      color: theme.colors.textDim,
      fontFamily: theme.typography.primary.normal,
      lineHeight: 20,
    },
    statusText: {
      fontSize: 13,
      color: theme.colors.textDim,
      fontFamily: theme.typography.primary.medium,
    },
    errorText: {
      fontSize: 13,
      color: theme.colors.palette.angry500 ?? "#EF4444",
      fontFamily: theme.typography.primary.medium,
    },
    actions: {
      gap: theme.spacing.sm,
      marginTop: theme.spacing.sm,
    },
    primaryButton: {
      borderRadius: 16,
      backgroundColor: theme.colors.palette.primary500,
    },
    primaryButtonText: {
      color: theme.colors.palette.neutral100,
      fontFamily: theme.typography.primary.semiBold ?? theme.typography.primary.medium,
    },
    secondaryButton: {
      borderRadius: 16,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : theme.colors.palette.neutral200,
    },
    secondaryButtonText: {
      color: theme.colors.text,
      fontFamily: theme.typography.primary.medium,
    },
    infoCard: {
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.05)" : theme.colors.palette.accent100,
      borderRadius: 20,
      padding: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    bulletRow: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      alignItems: "flex-start",
    },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: theme.spacing.xs,
      backgroundColor: theme.colors.palette.primary500,
    },
    bulletText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.text,
      fontFamily: theme.typography.primary.normal,
    },
    supportLink: {
      textAlign: "center",
      fontSize: 14,
      color: theme.colors.palette.primary500,
      fontFamily: theme.typography.primary.medium,
    },
    updatedText: {
      textAlign: "center",
      fontSize: 12,
      color: theme.colors.textDim,
      fontFamily: theme.typography.primary.normal,
      marginBottom: theme.spacing.xl,
    },
    loadingState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.xl,
    },
    loadingText: {
      fontSize: 14,
      color: theme.colors.textDim,
      fontFamily: theme.typography.primary.normal,
    },
    fallbackState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.xl,
    },
    fallbackTitle: {
      textAlign: "center",
      color: theme.colors.text,
    },
    fallbackMessage: {
      textAlign: "center",
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.textDim,
      fontFamily: theme.typography.primary.normal,
      maxWidth: 280,
    },
  })
