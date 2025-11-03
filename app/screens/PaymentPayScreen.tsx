import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Alert, Linking, StyleSheet, View, ViewStyle } from "react-native"
import type { OolshikStackScreenProps } from "@/navigators/OolshikNavigator"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import type { Theme } from "@/theme/types"
import { OolshikApi } from "@/api/client"

const USE_PAYMENT_DEMO = true

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
  payeeName: string
  payeeVpa: string
  amountRequested: number
  note?: string
  dueDate?: string
  status?: string
  lastUpdated?: string
  contactNumber?: string
  paymentWindow?: string
  breakdown?: PaymentBreakdownItem[]
  highlights?: PaymentHighlight[]
  disclaimers?: string[]
}

type PaymentRequestPayload = {
  upiIntent?: string
  supportLink?: string
  snapshot: PaymentSnapshot
}

const DEMO_PAYMENT_REQUEST: PaymentRequestPayload = {
  upiIntent: "upi://pay?pa=raghav@ybl&pn=Raghav%20Khanna&am=1350.00&cu=INR&tn=Fuel%20reimbursement",
  supportLink: "https://help.oolshik.com/payments/demo",
  snapshot: {
    id: "demo-req-1042",
    payeeName: "Raghav Khanna",
    payeeVpa: "raghav@ybl",
    amountRequested: 1350,
    note: "Fuel reimbursement for the Navi Mumbai drop-off run.",
    dueDate: new Date(Date.now() + 36 * 60 * 60 * 1000).toISOString(),
    status: "Awaiting payment",
    lastUpdated: new Date().toISOString(),
    contactNumber: "+91 98765 43210",
    paymentWindow: "Complete within 24 hours",
    breakdown: [
      { label: "Task payout", amount: 1100 },
      { label: "Travel allowance", amount: 200 },
      { label: "Platform fee", amount: 50 },
    ],
    highlights: [
      { label: "Task", value: "Delivery • #DLV-2759" },
      { label: "Assigned by", value: "Netra Patil" },
    ],
    disclaimers: [
      "Transfers are only accepted from the registered bank account.",
      "If your UPI app does not redirect back, upload the proof in Payments.",
      "For discrepancies contact support before marking the request as paid.",
    ],
  },
}

interface PaymentPayScreenProps extends OolshikStackScreenProps<"PaymentPay"> {}

export const PaymentPayScreen: React.FC<PaymentPayScreenProps> = ({ route }) => {
  const { taskId } = route.params
  const { theme } = useAppTheme()
  const styles = useMemo(() => createStyles(theme), [theme])

  const [loading, setLoading] = useState(true)
  const [payment, setPayment] = useState<PaymentRequestPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLaunchingPayment, setIsLaunchingPayment] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const requestIdRef = useRef(0)

  const loadPayment = useCallback(async () => {
    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    try {
      if (USE_PAYMENT_DEMO) {
        await delay(320)
        if (requestId !== requestIdRef.current) return
        setPayment(DEMO_PAYMENT_REQUEST)
      } else {
        const response = await OolshikApi.getPaymentRequest(taskId)
        if (requestId !== requestIdRef.current) return
        const normalized = normalizePaymentResponse(response)
        if (!normalized) throw new Error("Payment snapshot missing")
        setPayment(normalized)
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return
      setPayment(null)
      setError(extractErrorMessage(err))
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [taskId])

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
    if (!payment?.upiIntent) {
      Alert.alert("Unavailable", "We couldn't find a UPI link for this request.")
      return
    }
    setIsLaunchingPayment(true)
    try {
      if (!USE_PAYMENT_DEMO) {
        await OolshikApi.initiatePayment(taskId)
      }
      const isSupported = await Linking.canOpenURL(payment.upiIntent)
      if (!isSupported) {
        Alert.alert(
          "No UPI app found",
          "Install any UPI compatible app to continue or copy the link:\n\n" + payment.upiIntent,
        )
        return
      }
      await Linking.openURL(payment.upiIntent)
    } catch (err) {
      Alert.alert("Failed to start payment", extractErrorMessage(err))
    } finally {
      setIsLaunchingPayment(false)
    }
  }, [payment, taskId])

  const handleMarkPaid = useCallback(async () => {
    setIsConfirming(true)
    try {
      if (!USE_PAYMENT_DEMO) {
        await OolshikApi.markPaid(taskId, {})
      }
      Alert.alert("Thanks!", "We'll mark this request as paid.")
    } catch (err) {
      Alert.alert("Unable to mark as paid", extractErrorMessage(err))
    } finally {
      setIsConfirming(false)
    }
  }, [taskId])

  const handleSupportPress = useCallback(async () => {
    if (!payment?.supportLink) return
    try {
      const supported = await Linking.canOpenURL(payment.supportLink)
      if (!supported) {
        Alert.alert(
          "Unable to open support link",
          "Copy and open this link manually:\n\n" + payment.supportLink,
        )
        return
      }
      await Linking.openURL(payment.supportLink)
    } catch (err) {
      Alert.alert("Unable to open support", extractErrorMessage(err))
    }
  }, [payment])

  if (loading) {
    return (
      <Screen style={$root} preset="fixed">
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.colors.palette.primary500} />
          <Text style={styles.loadingText} text="Preparing payment summary…" />
        </View>
      </Screen>
    )
  }

  if (error) {
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
  const updatedDisplay = formatDate(snapshot.lastUpdated)
  const breakdown = snapshot.breakdown ?? []
  const highlights = snapshot.highlights ?? []
  const disclaimers = snapshot.disclaimers ?? []
  const breakdownTotal = breakdown.reduce((sum, item) => sum + (item.amount ?? 0), 0)

  return (
    <Screen style={$root} preset="scroll" contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.heroLabel} text="Transfer amount" />
        <Text style={styles.heroAmount} text={amountDisplay} />
        <View style={styles.heroMetaRow}>
          <View style={styles.heroChip}>
            <Text
              style={styles.heroChipText}
              text={(snapshot.status ?? "Awaiting payment").toUpperCase()}
            />
          </View>
          {dueDisplay ? <Text style={styles.heroMetaText} text={`Due ${dueDisplay}`} /> : null}
        </View>
        {snapshot.note ? <Text style={styles.heroNote}>{snapshot.note}</Text> : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle} text="Payee details" />
        {snapshot.payeeName ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel} text="Recipient" />
            <Text style={styles.rowValue} numberOfLines={1} text={snapshot.payeeName} />
          </View>
        ) : null}
        {snapshot.payeeVpa ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel} text="UPI ID" />
            <Text
              style={[styles.rowValue, styles.monoValue]}
              numberOfLines={1}
              text={snapshot.payeeVpa}
            />
          </View>
        ) : null}
        {snapshot.paymentWindow ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel} text="Payment window" />
            <Text style={styles.rowValue} numberOfLines={2} text={snapshot.paymentWindow} />
          </View>
        ) : null}
        {snapshot.contactNumber ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel} text="Contact" />
            <Text style={styles.rowValue} numberOfLines={1} text={snapshot.contactNumber} />
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
        <View style={styles.actions}>
          <Button
            text={isLaunchingPayment ? "Opening UPI…" : "Pay with UPI"}
            onPress={handleLaunchUpi}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
            disabled={isLaunchingPayment}
          />
          <Button
            text={isConfirming ? "Marking…" : "I've paid already"}
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

      {payment.supportLink ? (
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

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const formatCurrency = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "—"
  return `₹${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const formatDate = (value?: string, overrides?: Intl.DateTimeFormatOptions) => {
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
  return {
    upiIntent: candidate.upiIntent ?? response?.upiIntent ?? response?.data?.upiIntent,
    supportLink: candidate.supportLink ?? response?.supportLink ?? response?.data?.supportLink,
    snapshot: candidate.snapshot,
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
