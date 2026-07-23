import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import Clipboard from "@react-native-clipboard/clipboard"
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
import { useTranslation } from "react-i18next"
import { normalizeLocaleTag } from "@/i18n/locale"
import { maskUpiId } from "@/utils/paymentProfile"
import { useAuth } from "@/context/AuthContext"
import { getInstalledUpiApps, openUpiApp } from "@/services/upiLauncher"
import { useResponsiveLayout } from "@/utils/useResponsiveLayout"

type PaymentBreakdownItem = {
  label: string
  amount: number
  hint?: string
}

type PaymentHighlight = {
  label: string
  value: string
  type?: string
}

type PaymentSnapshot = {
  id?: string
  payeeName?: string | null
  payeeVpa?: string | null
  payeeMaskedVpa?: string | null
  scannedPayeeName?: string | null
  scannedPayeeVpa?: string | null
  scannedPayeeMaskedVpa?: string | null
  amountRequested?: number | null
  note?: string | null
  txnRef?: string | null
  dueDate?: string | null
  status?: string | null
  lastUpdated?: string | null
  contactNumber?: string | null
  paymentWindow?: string | null
  payeePhoneNumber?: string | null
  breakdown?: PaymentBreakdownItem[]
  highlights?: PaymentHighlight[]
  disclaimers?: string[]
}

type PaymentRequestPayload = {
  upiIntent?: string
  scannedUpiIntent?: string
  supportLink?: string
  payerRole?: "REQUESTER" | "HELPER"
  payerName?: string | null
  payeeName?: string | null
  payerUserId?: string | null
  payeeUserId?: string | null
  validationStatus?: "MATCHED" | "NEEDS_REVIEW" | "MISMATCH" | null
  validationWarnings?: string[]
  snapshot: PaymentSnapshot
}

type BuildSeedArgs = {
  paymentRequestId?: string
  scanPayload: PaymentScanPayload
  taskContext?: PaymentTaskContext
  labels: { task: string; requester: string }
}

const DEFAULT_STATUS = "PENDING"

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

const buildSeedPayment = ({ paymentRequestId, scanPayload, taskContext, labels }: BuildSeedArgs) => {
  const amount =
    typeof scanPayload.amount === "number" && !Number.isNaN(scanPayload.amount)
      ? scanPayload.amount
      : null

  const highlights: PaymentHighlight[] = []
  if (taskContext?.title) {
    highlights.push({ type: "task", label: labels.task, value: taskContext.title })
  }
  if (taskContext?.createdByName) {
    highlights.push({ type: "requester", label: labels.requester, value: taskContext.createdByName })
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
  mergedSnapshot.payeeMaskedVpa = next.snapshot.payeeMaskedVpa ?? base.snapshot.payeeMaskedVpa ?? null
  mergedSnapshot.scannedPayeeVpa = next.snapshot.scannedPayeeVpa ?? base.snapshot.scannedPayeeVpa ?? null
  mergedSnapshot.scannedPayeeMaskedVpa =
    next.snapshot.scannedPayeeMaskedVpa ?? base.snapshot.scannedPayeeMaskedVpa ?? null
  mergedSnapshot.scannedPayeeName = next.snapshot.scannedPayeeName ?? base.snapshot.scannedPayeeName ?? null
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
    scannedUpiIntent: next.scannedUpiIntent ?? base.scannedUpiIntent,
    supportLink: next.supportLink ?? base.supportLink,
    payerRole: next.payerRole ?? base.payerRole,
    payerName: next.payerName ?? base.payerName ?? null,
    payeeName: next.payeeName ?? base.payeeName ?? mergedSnapshot.payeeName ?? null,
    payerUserId: next.payerUserId ?? base.payerUserId ?? null,
    payeeUserId: next.payeeUserId ?? base.payeeUserId ?? null,
    validationStatus: next.validationStatus ?? base.validationStatus ?? null,
    validationWarnings: next.validationWarnings ?? base.validationWarnings,
    snapshot: mergedSnapshot,
  }
}

interface PaymentPayScreenProps extends OolshikStackScreenProps<"PaymentPay"> {}

export const PaymentPayScreen: React.FC<PaymentPayScreenProps> = ({ route, navigation }) => {
  const {
    taskId, paymentRequestId, scanPayload, taskContext, upiIntentOverride,
    payerRole, payerName, payeeName: routePayeeName, payerUserId, payeeUserId,
    currentUserPaymentRole: routeCurrentUserPaymentRole,
  } = route.params
  const { t, i18n } = useTranslation()
  const localeTag = normalizeLocaleTag(i18n.language)
  const { theme } = useAppTheme()
  const { scaleDisplayText, scaleHeroText, screenPaddingH } = useResponsiveLayout()
  const styles = useMemo(
    () => createStyles(theme, scaleDisplayText, scaleHeroText, screenPaddingH),
    [theme, scaleDisplayText, scaleHeroText, screenPaddingH],
  )
  const { userId } = useAuth()

  const seedPayment = useMemo(() => {
    const labels = { task: t("payment:pay.highlightTask"), requester: t("payment:pay.highlightRequester") }
    const base = buildSeedPayment({ paymentRequestId, scanPayload, taskContext, labels })
    return {
      ...base,
      payerRole,
      payerName: payerName ?? null,
      payeeName: routePayeeName ?? base.snapshot.payeeName ?? null,
      payerUserId: payerUserId ?? null,
      payeeUserId: payeeUserId ?? null,
      upiIntent: upiIntentOverride ?? base.upiIntent,
    }
  }, [paymentRequestId, scanPayload, taskContext, upiIntentOverride, payerRole, payerName, routePayeeName, payerUserId, payeeUserId, t])

  const [payment, setPayment] = useState<PaymentRequestPayload | null>(seedPayment)
  const [loading, setLoading] = useState<boolean>(Boolean(paymentRequestId))
  const [error, setError] = useState<string | null>(null)
  const [isLaunchingPayment, setIsLaunchingPayment] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [hasLaunchedUpi, setHasLaunchedUpi] = useState(false)
  const [isFallbackExpanded, setIsFallbackExpanded] = useState(false)
  const [lastLaunchedKind, setLastLaunchedKind] = useState<"profile" | "scanned">("profile")
  const [launchingKind, setLaunchingKind] = useState<"profile" | "scanned" | null>(null)
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
      setError(extractErrorMessage(err, t("payment:pay.unknownError")))
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

  const handleLaunchUpi = useCallback(async (kind: "profile" | "scanned" = "profile") => {
    const upiIntent =
      kind === "scanned"
        ? payment?.scannedUpiIntent
        : (payment?.upiIntent ?? seedPayment?.upiIntent)
    if (!upiIntent) {
      Alert.alert(t("payment:pay.unavailableTitle"), t("payment:pay.noUpiBody"))
      return
    }
    setIsLaunchingPayment(true)
    setLaunchingKind(kind)
    try {
      const identifier =
        paymentRequestId ?? payment?.snapshot.id ?? seedPayment?.snapshot.id ?? taskId
      if (identifier) {
        await OolshikApi.initiatePayment(identifier)
      }
      await Linking.openURL(upiIntent)
      setLastLaunchedKind(kind)
      setHasLaunchedUpi(true)
      setIsFallbackExpanded(true)
    } catch {
      // openURL throws when no app can handle the upi:// intent (no UPI app installed).
      Alert.alert(
        t("payment:pay.noUpiAppTitle"),
        t("payment:pay.noUpiAppBody", { upiLink: upiIntent }),
      )
    } finally {
      setIsLaunchingPayment(false)
      setLaunchingKind(null)
    }
  }, [payment, paymentRequestId, seedPayment, t])

  const handleOpenUpiAppOnly = useCallback(async () => {
    const installedApps = await getInstalledUpiApps()
    if (installedApps.length === 0) {
      Alert.alert(t("payment:pay.noUpiAppTitle"), t("payment:pay.noUpiAppBody", { upiLink: "" }))
      return
    }
    if (installedApps.length === 1) {
      await openUpiApp(installedApps[0].packageName)
      return
    }
    Alert.alert(
      t("payment:pay.openUpi"),
      undefined,
      [
        ...installedApps.map((app) => ({
          text: app.name,
          onPress: () => openUpiApp(app.packageName),
        })),
        { text: t("payment:pay.close"), style: "cancel" as const },
      ],
    )
  }, [t])

  const handleMarkPaid = useCallback(async () => {
    const identifier =
      paymentRequestId ?? payment?.snapshot.id ?? seedPayment?.snapshot.id ?? taskId
    if (!identifier) {
      Alert.alert(t("payment:pay.unavailableTitle"), t("payment:pay.noRequestIdBody"))
      return
    }
    const confirmPayeeName =
      payment?.payeeName ??
      routePayeeName ??
      payment?.snapshot.payeeName ??
      seedPayment?.payeeName ??
      seedPayment?.snapshot.payeeName ??
      null
    const confirmTitle = confirmPayeeName
      ? t("payment:pay.confirmPaidNameTitle", { name: confirmPayeeName })
      : t("payment:pay.confirmPaidTitle")
    const confirmBody = confirmPayeeName
      ? t("payment:pay.confirmPaidNameBody", { name: confirmPayeeName })
      : t("payment:pay.confirmPaidBody")
    Alert.alert(
      confirmTitle,
      confirmBody,
      [
        { text: t("common:cancel"), style: "cancel" },
        {
          text: t("payment:pay.confirmPaidCta"),
          style: "default",
          onPress: async () => {
            setIsConfirming(true)
            try {
              await OolshikApi.markPaid(identifier, {})
              Alert.alert(
                t("payment:pay.paidTitle"),
                t("payment:pay.paidBody"),
                [
                  {
                    text: t("payment:pay.close"),
                    onPress: () => navigation.goBack(),
                  },
                ],
              )
            } catch (err) {
              Alert.alert(t("payment:pay.markFailTitle"), extractErrorMessage(err, t("payment:pay.unknownError")))
            } finally {
              setIsConfirming(false)
            }
          },
        },
      ],
      { cancelable: true },
    )
  }, [navigation, payment, paymentRequestId, routePayeeName, seedPayment, t, taskId])

  const handleSupportPress = useCallback(async () => {
    const supportLink = payment?.supportLink ?? seedPayment?.supportLink
    if (!supportLink) return
    try {
      const supported = await Linking.canOpenURL(supportLink)
      if (!supported) {
        Alert.alert(
          t("payment:pay.supportFailTitle"),
          t("payment:pay.supportFailBody", { link: supportLink }),
        )
        return
      }
      await Linking.openURL(supportLink)
    } catch (err) {
      Alert.alert(t("payment:pay.supportFailTitle"), extractErrorMessage(err, t("payment:pay.unknownError")))
    }
  }, [payment, seedPayment, t])

  const handleCallRequester = useCallback(async () => {
    const phone = taskContext?.createdByPhoneNumber
    if (!phone) return
    const url = `tel:${phone}`
    try {
      const supported = await Linking.canOpenURL(url)
      if (!supported) {
        Alert.alert(t("payment:pay.callNotSupported"))
        return
      }
      await Linking.openURL(url)
    } catch {
      Alert.alert(t("payment:pay.callFailed"))
    }
  }, [taskContext?.createdByPhoneNumber, t])

  if (loading && !payment) {
    return (
      <Screen style={$root} preset="fixed">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backLinkFixed}>
          <Text text={`← ${t("common:back")}`} />
        </Pressable>
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.colors.palette.primary500} />
          <Text style={styles.loadingText} text={t("payment:pay.fallbackLoading")} />
        </View>
      </Screen>
    )
  }

  if (error && !payment) {
    return (
      <Screen style={$root} preset="fixed">
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backLinkFixed}>
          <Text text={`← ${t("common:back")}`} />
        </Pressable>
        <View style={styles.fallbackState}>
          <Text preset="heading" style={styles.fallbackTitle} text={t("payment:pay.fallbackNotReadyTitle")} />
          <Text style={styles.fallbackMessage}>{error}</Text>
          <Button
            text={t("payment:pay.retry")}
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
        <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backLinkFixed}>
          <Text text={`← ${t("common:back")}`} />
        </Pressable>
        <View style={styles.fallbackState}>
          <Text preset="heading" style={styles.fallbackTitle} text={t("payment:pay.fallbackMissingTitle")} />
          <Text style={styles.fallbackMessage}>
            {t("payment:pay.fallbackMissingBody")}
          </Text>
          <Button
            text={t("payment:pay.reload")}
            onPress={handleRetry}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />
        </View>
      </Screen>
    )
  }

  const snapshot = payment.snapshot
  const amountDisplay = formatCurrency(snapshot.amountRequested, localeTag)
  const dueDisplay = formatDate(snapshot.dueDate, localeTag, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
  const updatedDisplay = formatDate(snapshot.lastUpdated ?? scanPayload.scannedAt, localeTag)
  const breakdown = snapshot.breakdown ?? []
  const highlights = snapshot.highlights ?? []
  const disclaimers = snapshot.disclaimers ?? scanPayload.guidelines ?? []
  const displayUpiId = snapshot.payeeMaskedVpa ?? maskUpiId(snapshot.payeeVpa ?? scanPayload.payeeVpa)
  const displayScannedUpiId = snapshot.scannedPayeeMaskedVpa ?? maskUpiId(snapshot.scannedPayeeVpa)
  const hasScannedDestination = Boolean(payment.scannedUpiIntent && snapshot.scannedPayeeVpa)
  const activeFallbackVpa = lastLaunchedKind === "scanned" ? snapshot.scannedPayeeVpa : snapshot.payeeVpa
  const breakdownTotal = breakdown.reduce((sum, item) => sum + (item.amount ?? 0), 0)
  const inlineError = error && payment ? error : null
  const supportLink = payment?.supportLink ?? seedPayment?.supportLink
  const contextTitle = taskContext?.title?.trim() || snapshot.highlights?.find((item) => item.type === "task")?.value
  const requesterName =
    taskContext?.createdByName?.trim() ||
    snapshot.highlights?.find((item) => item.type === "requester")?.value ||
    snapshot.payeeName ||
    null

  const effectivePayeeName = toTitleCase(payment.payeeName ?? routePayeeName ?? snapshot.payeeName ?? requesterName ?? null)
  const effectivePayerName = toTitleCase(payment.payerName ?? payerName ?? null)
  const effectivePayerUserId = payment.payerUserId ?? payerUserId ?? null
  const effectivePayeeUserId = payment.payeeUserId ?? payeeUserId ?? null
  const currentUserRoleInPayment: "PAYER" | "PAYEE" | "VIEWER" =
    routeCurrentUserPaymentRole
      ? routeCurrentUserPaymentRole
      : userId && effectivePayerUserId && String(userId) === String(effectivePayerUserId)
        ? "PAYER"
        : userId && effectivePayeeUserId && String(userId) === String(effectivePayeeUserId)
          ? "PAYEE"
          : "VIEWER"
  const displayReference = formatReference(snapshot.id ?? paymentRequestId ?? taskId)
  const technicalReference = snapshot.id ?? paymentRequestId ?? null
  const handleCopyReference = () => {
    if (!displayReference) return
    Clipboard.setString(technicalReference ?? displayReference)
    Alert.alert(t("payment:pay.referenceCopiedTitle"), t("payment:pay.referenceCopiedBody"))
  }
  const heroMessage = buildHeroMessage({
    note: snapshot.note,
    contextTitle,
    requesterName,
    t,
  })
  const requesterInitials = buildInitials(requesterName)
  const statusText = useMemo(() => {
    const status = (snapshot.status ?? DEFAULT_STATUS).toUpperCase()
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
        return t("payment:pay.defaultStatus")
    }
  }, [snapshot.status, t])

  return (
    <Screen style={$root} preset="scroll" contentContainerStyle={styles.content}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backLink}>
        <Text text={`← ${t("common:back")}`} />
      </Pressable>

      <View style={styles.hero}>
        <View style={styles.heroGlow} />
        <View style={styles.heroHeader}>
          <View style={styles.heroAmountBlock}>
            <Text style={styles.heroLabel} text={t("payment:pay.transferAmount")} />
            <Text
              style={styles.heroAmount}
              text={amountDisplay}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            />
          </View>
          <View style={styles.heroStatusPill}>
            <MaterialCommunityIcons
              name="progress-clock"
              size={16}
              color={theme.colors.palette.neutral100}
            />
            <Text style={styles.heroStatusText} numberOfLines={1} text={statusText.toUpperCase()} />
          </View>
        </View>

        <Text style={styles.heroSupportText}>
          {heroMessage}
        </Text>

        <View style={styles.heroMetaRow}>
          {dueDisplay ? (
            <View style={styles.metaChip}>
              <MaterialCommunityIcons
                name="calendar-clock-outline"
                size={14}
                color={theme.colors.palette.neutral100}
              />
              <Text style={styles.metaChipText} text={t("payment:pay.duePrefix", { date: dueDisplay })} />
            </View>
          ) : null}
          {displayReference ? (
            <View style={styles.metaChip}>
              <MaterialCommunityIcons
                name="pound"
                size={14}
                color={theme.colors.palette.neutral100}
              />
              <Text style={styles.metaChipText} text={`${t("payment:pay.reference")}: ${displayReference}`} />
            </View>
          ) : null}
        </View>

        {(contextTitle || requesterName) ? (
          <View style={styles.contextCard}>
            <View style={styles.contextHeader}>
              <View style={styles.contextIconBadge}>
                <MaterialCommunityIcons
                  name="clipboard-text-outline"
                  size={18}
                  color={theme.colors.palette.primary500}
                />
              </View>
              <Text style={styles.contextEyebrow} text={t("payment:pay.taskContext")} />
            </View>

            <Text
              style={styles.contextTitle}
              numberOfLines={2}
              ellipsizeMode="tail"
              text={contextTitle || t("payment:pay.contextFallbackTitle")}
            />

            {requesterName ? (
              <View style={styles.requesterCard}>
                <View style={styles.requesterAvatar}>
                  <Text style={styles.requesterAvatarText} text={requesterInitials} />
                </View>
                <View style={styles.requesterCopy}>
                  <Text style={styles.requesterLabel} text={t("payment:pay.requestedBy")} />
                  <Text
                    style={styles.requesterName}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    text={requesterName}
                  />
                  {taskContext?.createdByPhoneNumber ? (
                    <Pressable
                      onPress={handleCallRequester}
                      style={({ pressed }) => [styles.requesterContactPill, pressed && { opacity: 0.65 }]}
                      accessibilityRole="button"
                      accessibilityLabel={t("payment:pay.callRequester")}
                      accessibilityHint={taskContext.createdByPhoneNumber}
                    >
                      <MaterialCommunityIcons
                        name="phone-outline"
                        size={14}
                        color={theme.colors.palette.primary500}
                      />
                      <Text
                        style={styles.requesterContactText}
                        numberOfLines={1}
                        text={taskContext.createdByPhoneNumber}
                      />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {currentUserRoleInPayment !== "VIEWER" ? (
        <View style={styles.roleContextBanner}>
          <Text style={styles.roleContextText}>
            {currentUserRoleInPayment === "PAYER"
              ? t("payment:pay.roleYouArePaying", { name: effectivePayeeName ?? "—" })
              : t("payment:pay.roleYouReceiveFrom", { name: effectivePayerName ?? "—" })}
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle} text={t("payment:pay.payeeDetails")} />
        <View style={styles.payeeHero}>
          <View style={styles.payeeAvatar}>
            <MaterialCommunityIcons
              name="account-cash-outline"
              size={22}
              color={theme.colors.palette.primary500}
            />
          </View>
          <View style={styles.payeeHeroCopy}>
            <Text style={styles.payeeEyebrow} text={t("payment:pay.recipient")} />
            <Text style={styles.payeeName} numberOfLines={2} text={effectivePayeeName ?? "—"} />
            <Text
              style={[styles.payeeUpi, styles.monoValue]}
              numberOfLines={2}
              text={displayUpiId ?? "—"}
            />
          </View>
        </View>

        {displayReference ? (
          <Pressable style={styles.referenceTile} onPress={handleCopyReference}>
            <View style={styles.referenceTileInner}>
              <Text style={styles.detailTileLabel} text={t("payment:pay.reference")} />
              <Text style={[styles.detailTileValue, styles.monoValue]} text={displayReference} />
            </View>
            <MaterialCommunityIcons
              name="content-copy"
              size={16}
              color={theme.colors.textDim}
            />
          </Pressable>
        ) : null}

        {snapshot.paymentWindow ? (
          <View style={styles.row}>
            <Text style={styles.rowLabel} text={t("payment:pay.paymentWindow")} />
            <Text style={styles.rowValue} numberOfLines={2} text={snapshot.paymentWindow} />
          </View>
        ) : null}
        {snapshot.contactNumber ? (
          <Pressable style={styles.row} onPress={() => Linking.openURL(`tel:${snapshot.contactNumber}`)}>
            <Text style={styles.rowLabel} text={t("payment:pay.contact")} />
            <Text style={[styles.rowValue, styles.contactLink]} numberOfLines={1} text={snapshot.contactNumber} />
          </Pressable>
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
        <Text style={styles.secureNote}>
          {t("payment:pay.secureNote")}
        </Text>
      </View>

      {breakdown.length ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle} text={t("payment:pay.breakdown")} />
          {breakdown.map((item) => (
            <View style={styles.row} key={item.label}>
              <Text style={styles.rowLabel} text={item.label} />
              <Text style={styles.rowValue} text={formatCurrency(item.amount, localeTag)} />
            </View>
          ))}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.rowLabel} text={t("payment:pay.totalPayable")} />
            <Text style={[styles.rowValue, styles.totalValue]} text={amountDisplay} />
          </View>
          {breakdownTotal && breakdownTotal !== snapshot.amountRequested ? (
            <Text style={styles.breakdownHint}>
              {t("payment:pay.breakdownHint")}
            </Text>
          ) : null}
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle} text={t("payment:pay.takeAction")} />
        <Text style={styles.cardSupport}>
          {t("payment:pay.actionHelp")}
        </Text>
        {loading && paymentRequestId ? (
          <Text style={styles.statusText}>{t("payment:pay.refreshing")}</Text>
        ) : null}
        {inlineError ? <Text style={styles.errorText}>{inlineError}</Text> : null}
        {currentUserRoleInPayment === "PAYER" ? (
          <View style={styles.actions}>
            {hasScannedDestination ? (
              <>
                <Text style={styles.cardSupport} text={t("payment:pay.chooseDestinationHint")} />
                <View style={styles.destinationCard}>
                  <Text style={styles.detailTileLabel} text={t("payment:pay.profileDestinationLabel")} />
                  <Text style={[styles.detailTileValue, styles.monoValue]} text={displayUpiId ?? "—"} />
                  {effectivePayeeName ? (
                    <Text style={styles.monoSubtle} text={effectivePayeeName} />
                  ) : null}
                  <Button
                    text={
                      launchingKind === "profile"
                        ? t("payment:pay.openingUpi")
                        : t("payment:pay.payViaProfile")
                    }
                    onPress={() => handleLaunchUpi("profile")}
                    style={styles.primaryButton}
                    textStyle={styles.primaryButtonText}
                    disabled={isLaunchingPayment}
                  />
                </View>
                <View style={styles.destinationCard}>
                  <Text style={styles.detailTileLabel} text={t("payment:pay.scannedDestinationLabel")} />
                  <Text style={[styles.detailTileValue, styles.monoValue]} text={displayScannedUpiId ?? "—"} />
                  {snapshot.scannedPayeeName ? (
                    <Text style={styles.monoSubtle} text={snapshot.scannedPayeeName} />
                  ) : null}
                  <Button
                    text={
                      launchingKind === "scanned"
                        ? t("payment:pay.openingUpi")
                        : t("payment:pay.payViaScanned")
                    }
                    onPress={() => handleLaunchUpi("scanned")}
                    style={styles.secondaryButton}
                    textStyle={styles.secondaryButtonText}
                    disabled={isLaunchingPayment}
                  />
                </View>
              </>
            ) : (
              <Button
                text={isLaunchingPayment
                  ? t("payment:pay.openingUpi")
                  : effectivePayeeName
                    ? t("payment:pay.payName", { name: effectivePayeeName })
                    : t("payment:pay.openUpi")}
                onPress={() => handleLaunchUpi("profile")}
                style={styles.primaryButton}
                textStyle={styles.primaryButtonText}
                disabled={isLaunchingPayment}
              />
            )}
            <Button
              text={isConfirming
                ? t("payment:pay.markingPaid")
                : effectivePayeeName
                  ? t("payment:pay.iPaidName", { name: effectivePayeeName })
                  : t("payment:pay.markPaid")}
              onPress={handleMarkPaid}
              style={styles.secondaryButton}
              textStyle={styles.secondaryButtonText}
              disabled={isConfirming}
            />
          </View>
        ) : currentUserRoleInPayment === "PAYEE" ? (
          <Text style={styles.waitingText}>
            {t("payment:pay.waitingForPayer", { name: effectivePayerName ?? "—" })}
          </Text>
        ) : (
          <Text style={styles.waitingText}>
            {t("payment:pay.viewerReadOnly")}
          </Text>
        )}
      </View>

      {hasLaunchedUpi && currentUserRoleInPayment === "PAYER" ? (
        <View style={styles.fallbackCard}>
          <Pressable
            style={styles.fallbackHeader}
            onPress={() => setIsFallbackExpanded((v) => !v)}
          >
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={18}
              color={theme.colors.palette.primary500}
            />
            <Text
              style={styles.fallbackCardTitle}
              numberOfLines={1}
              ellipsizeMode="tail"
              text={t("payment:pay.blockedPanelTitle")}
            />
            <MaterialCommunityIcons
              name={isFallbackExpanded ? "chevron-up" : "chevron-down"}
              size={20}
              color={theme.colors.textDim}
            />
          </Pressable>
          {isFallbackExpanded ? (
            <View style={styles.fallbackBody}>
              <Text style={styles.fallbackHint} text={t("payment:pay.blockedPanelHint")} />
              <View style={styles.fallbackActions}>
                {activeFallbackVpa ? (
                  <Pressable
                    style={styles.fallbackAction}
                    onPress={() => {
                      Clipboard.setString(activeFallbackVpa!)
                      Alert.alert(t("payment:pay.copiedToClipboard"), activeFallbackVpa!, [
                        { text: t("payment:pay.close"), style: "cancel" },
                        { text: t("payment:pay.openUpi"), style: "default", onPress: handleOpenUpiAppOnly },
                      ])
                    }}
                  >
                    <MaterialCommunityIcons name="content-copy" size={16} color={theme.colors.palette.primary500} />
                    <Text style={styles.fallbackActionText} text={t("payment:pay.copyUpiId")} />
                  </Pressable>
                ) : null}
                {typeof snapshot.amountRequested === "number" ? (
                  <Pressable
                    style={styles.fallbackAction}
                    onPress={() => {
                      Clipboard.setString(String(snapshot.amountRequested))
                      Alert.alert(t("payment:pay.copiedToClipboard"), amountDisplay)
                    }}
                  >
                    <MaterialCommunityIcons name="content-copy" size={16} color={theme.colors.palette.primary500} />
                    <Text style={styles.fallbackActionText} text={t("payment:pay.copyAmount")} />
                  </Pressable>
                ) : null}
                {snapshot.note || snapshot.txnRef ? (
                  <Pressable
                    style={styles.fallbackAction}
                    onPress={() => {
                      const value = snapshot.note ?? snapshot.txnRef ?? ""
                      Clipboard.setString(value)
                      Alert.alert(t("payment:pay.copiedToClipboard"), value)
                    }}
                  >
                    <MaterialCommunityIcons name="content-copy" size={16} color={theme.colors.palette.primary500} />
                    <Text style={styles.fallbackActionText} text={t("payment:pay.copyNote")} />
                  </Pressable>
                ) : null}
                <Pressable
                  style={styles.fallbackAction}
                  onPress={() => handleLaunchUpi(lastLaunchedKind)}
                  disabled={isLaunchingPayment}
                >
                  <MaterialCommunityIcons name="refresh" size={16} color={theme.colors.palette.primary500} />
                  <Text style={styles.fallbackActionText} text={t("payment:pay.tryAgainUpi")} />
                </Pressable>
                {lastLaunchedKind === "profile" && snapshot.payeePhoneNumber ? (
                  <Pressable
                    style={styles.fallbackAction}
                    onPress={() => {
                      const phone = snapshot.payeePhoneNumber!
                      Clipboard.setString(phone)
                      Alert.alert(t("payment:pay.copiedToClipboard"), `${phone}\n\n${t("payment:pay.payByMobileCopied")}`, [
                        { text: t("payment:pay.close"), style: "cancel" },
                        { text: t("payment:pay.openUpi"), style: "default", onPress: handleOpenUpiAppOnly },
                      ])
                    }}
                  >
                    <MaterialCommunityIcons name="phone-outline" size={16} color={theme.colors.palette.primary500} />
                    <Text style={styles.fallbackActionText} text={t("payment:pay.payByMobile")} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {disclaimers.length ? (
        <View style={styles.infoCard}>
          <Text style={styles.cardTitle} text={t("payment:pay.beforePaid")} />
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
          {t("payment:pay.needHelp")}
        </Text>
      ) : null}

      {updatedDisplay ? (
        <Text style={styles.updatedText} text={t("payment:pay.updatedAt", { date: updatedDisplay })} />
      ) : null}
    </Screen>
  )
}

const $root: ViewStyle = {
  flex: 1,
}

const formatCurrency = (value: number | null | undefined, localeTag: string) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "—"
  return new Intl.NumberFormat(localeTag, {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatDate = (
  value: string | null | undefined,
  localeTag: string,
  overrides?: Intl.DateTimeFormatOptions,
) => {
  if (!value) return undefined
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  return new Intl.DateTimeFormat(localeTag, {
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
    scannedUpiIntent:
      candidate.scannedUpiIntent ?? response?.scannedUpiIntent ?? response?.data?.scannedUpiIntent,
    supportLink: candidate.supportLink ?? response?.supportLink ?? response?.data?.supportLink,
    payerRole: candidate.payerRole ?? undefined,
    payerName: candidate.payerName ?? null,
    payeeName: candidate.payeeName ?? snapshotData.payeeName ?? null,
    payerUserId: candidate.payerUserId ? String(candidate.payerUserId) : null,
    payeeUserId: candidate.payeeUserId ? String(candidate.payeeUserId) : null,
    validationStatus: candidate.validationStatus ?? null,
    validationWarnings: Array.isArray(candidate.validationWarnings) ? candidate.validationWarnings : undefined,
    snapshot: {
      ...snapshotData,
      highlights,
      payeeMaskedVpa: snapshotData.payeeMaskedVpa ?? null,
      payeePhoneNumber: snapshotData.payeePhoneNumber ?? null,
      scannedPayeeVpa: snapshotData.scannedPayeeVpa ?? null,
      scannedPayeeMaskedVpa: snapshotData.scannedPayeeMaskedVpa ?? null,
      scannedPayeeName: snapshotData.scannedPayeeName ?? null,
      disclaimers: ensureStringArray(disclaimers),
    },
  }
}

const extractErrorMessage = (err: unknown, fallback = "") => {
  if (typeof err === "string") return err
  if (err instanceof Error) return err.message
  if (err && typeof err === "object") {
    const message =
      (err as any)?.response?.data?.message ?? (err as any)?.data?.message ?? (err as any)?.message
    if (typeof message === "string") return message
  }
  return fallback
}

const formatReference = (value?: string | null) => {
  if (!value) return undefined
  const compact = value.replace(/[^a-zA-Z0-9]/g, "")
  if (!compact) return undefined
  const tail = compact.slice(-8).toUpperCase()
  return `#${tail}`
}

const toTitleCase = (value?: string | null): string | null => {
  if (!value) return null
  return value
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const buildInitials = (value?: string | null) => {
  if (!value) return "OP"
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
  if (!parts.length) return "OP"
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("")
}

const buildHeroMessage = ({
  note,
  contextTitle,
  requesterName,
  t,
}: {
  note?: string | null
  contextTitle?: string | null
  requesterName?: string | null
  t: (key: string, options?: Record<string, unknown>) => string
}) => {
  if (contextTitle) {
    return t("payment:pay.contextHeroBody", { task: contextTitle })
  }

  const cleanedNote = note
    ?.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim()

  if (cleanedNote && cleanedNote.length >= 12) return cleanedNote
  if (requesterName) {
    return t("payment:pay.requesterHeroBody", { name: requesterName })
  }
  return t("payment:pay.defaultHeroBody")
}

const createStyles = (
  theme: Theme,
  scaleDisplayText: (size: number) => number,
  scaleHeroText: (size: number) => number,
  screenPaddingH: number,
) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: screenPaddingH,
      paddingVertical: theme.spacing.xl,
      gap: theme.spacing.lg,
    },
    backLink: {
      alignSelf: "flex-start",
    },
    backLinkFixed: {
      alignSelf: "flex-start",
      padding: theme.spacing.md,
    },
    hero: {
      backgroundColor: theme.isDark
        ? theme.colors.palette.primary200
        : theme.colors.palette.primary500,
      borderRadius: 24,
      padding: theme.spacing.xl,
      gap: theme.spacing.md,
      shadowColor: theme.isDark ? "#00000080" : "#00000040",
      shadowOpacity: theme.isDark ? 0.25 : 0.18,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
      overflow: "hidden",
      position: "relative",
    },
    heroGlow: {
      position: "absolute",
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: "rgba(255,255,255,0.08)",
      top: -72,
      right: -28,
    },
    heroHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      flexWrap: "wrap",
    },
    heroAmountBlock: {
      flex: 1,
      minWidth: 0,
    },
    heroLabel: {
      color: theme.colors.palette.neutral200,
      fontSize: 14,
      opacity: 0.9,
      fontFamily: theme.typography.primary.medium,
    },
    heroAmount: {
      color: theme.colors.palette.neutral100,
      fontSize: scaleHeroText(38),
      lineHeight: scaleHeroText(44),
      fontFamily: theme.typography.primary.bold,
    },
    heroStatusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
      borderRadius: 999,
      backgroundColor: "rgba(255,255,255,0.14)",
      flexShrink: 0,
      maxWidth: "55%",
    },
    heroStatusText: {
      color: theme.colors.palette.neutral100,
      fontSize: 12,
      letterSpacing: 0.5,
      fontFamily: theme.typography.primary.medium,
      flexShrink: 1,
    },
    heroSupportText: {
      color: theme.colors.palette.neutral100,
      fontSize: scaleDisplayText(16),
      lineHeight: scaleDisplayText(24),
      opacity: 0.96,
      fontFamily: theme.typography.primary.normal,
    },
    heroMetaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    metaChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 7,
      backgroundColor: "rgba(255,255,255,0.12)",
    },
    metaChipText: {
      color: theme.colors.palette.neutral100,
      fontSize: 12,
      lineHeight: 16,
      opacity: 0.92,
      fontFamily: theme.typography.primary.normal,
    },
    contextCard: {
      borderRadius: 20,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
      backgroundColor: "rgba(255,255,255,0.14)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
    },
    contextHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    contextIconBadge: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.colors.palette.neutral100,
      alignItems: "center",
      justifyContent: "center",
    },
    contextEyebrow: {
      color: theme.colors.palette.neutral100,
      opacity: 0.78,
      fontSize: 12,
      letterSpacing: 0.5,
      fontFamily: theme.typography.primary.medium,
      textTransform: "uppercase",
    },
    contextTitle: {
      color: theme.colors.palette.neutral100,
      fontSize: scaleDisplayText(20),
      lineHeight: scaleDisplayText(28),
      fontFamily: theme.typography.primary.bold,
    },
    requesterCard: {
      borderRadius: 18,
      padding: theme.spacing.sm,
      gap: theme.spacing.sm,
      backgroundColor: "rgba(255,255,255,0.12)",
      flexDirection: "row",
      alignItems: "flex-start",
    },
    requesterAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.palette.neutral100,
      alignItems: "center",
      justifyContent: "center",
    },
    requesterAvatarText: {
      color: theme.colors.palette.primary500,
      fontSize: 15,
      fontFamily: theme.typography.primary.bold,
    },
    requesterCopy: {
      flex: 1,
      minWidth: 0,
      gap: theme.spacing.xs,
    },
    requesterLabel: {
      color: theme.colors.palette.neutral100,
      opacity: 0.72,
      fontSize: 11,
      fontFamily: theme.typography.primary.medium,
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    requesterName: {
      color: theme.colors.palette.neutral100,
      fontSize: scaleDisplayText(16),
      lineHeight: scaleDisplayText(22),
      fontFamily: theme.typography.primary.semiBold ?? theme.typography.primary.medium,
    },
    requesterContactPill: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
      backgroundColor: theme.colors.palette.neutral100,
    },
    requesterContactText: {
      color: theme.colors.palette.primary500,
      fontSize: 12,
      fontFamily: theme.typography.primary.medium,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 20,
      padding: theme.spacing.lg,
      gap: theme.spacing.xs,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    cardTitle: {
      fontSize: scaleDisplayText(18),
      fontFamily: theme.typography.primary.medium,
      marginBottom: theme.spacing.sm,
      color: theme.colors.text,
    },
    payeeHero: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
      marginBottom: theme.spacing.xs,
    },
    payeeAvatar: {
      width: 52,
      height: 52,
      borderRadius: 18,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : theme.colors.palette.accent100,
      alignItems: "center",
      justifyContent: "center",
    },
    payeeHeroCopy: {
      flex: 1,
      minWidth: 0,
      gap: 2,
    },
    payeeEyebrow: {
      fontSize: 12,
      color: theme.colors.textDim,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      fontFamily: theme.typography.primary.medium,
    },
    payeeName: {
      fontSize: scaleDisplayText(20),
      lineHeight: scaleDisplayText(26),
      color: theme.colors.text,
      fontFamily: theme.typography.primary.bold,
    },
    payeeUpi: {
      fontSize: 14,
      color: theme.colors.textDim,
      fontFamily: theme.typography.primary.medium,
    },
    referenceTile: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 16,
      padding: theme.spacing.sm,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.palette.neutral200,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: theme.spacing.xs,
    },
    referenceTileInner: {
      gap: 4,
    },
    destinationCard: {
      borderRadius: 16,
      padding: theme.spacing.sm,
      gap: 6,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.palette.neutral200,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    contactLink: {
      color: theme.colors.palette.primary500,
    },
    detailTileLabel: {
      fontSize: 11,
      color: theme.colors.textDim,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      fontFamily: theme.typography.primary.medium,
    },
    detailTileValue: {
      fontSize: 14,
      color: theme.colors.text,
      fontFamily: theme.typography.primary.semiBold ?? theme.typography.primary.medium,
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
      minWidth: 0,
    },
    rowValue: {
      fontSize: 16,
      color: theme.colors.text,
      fontFamily: theme.typography.primary.medium,
      flex: 1,
      minWidth: 0,
      textAlign: "right",
    },
    monoValue: {
      fontFamily: theme.typography.code?.normal ?? theme.typography.primary.medium,
    },
    monoSubtle: {
      fontFamily: theme.typography.code?.normal ?? theme.typography.primary.medium,
      fontSize: 13,
      color: theme.colors.textDim,
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
      borderRadius: 14,
      paddingVertical: 8,
      paddingHorizontal: theme.spacing.sm,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : theme.colors.palette.accent100,
      flex: 1,
      flexBasis: "45%",
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
    secureNote: {
      marginTop: theme.spacing.sm,
      color: theme.colors.textDim,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: theme.typography.primary.normal,
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
      backgroundColor: theme.isDark
        ? theme.colors.palette.primary200
        : theme.colors.palette.primary500,
    },
    primaryButtonText: {
      color: theme.colors.palette.neutral100,
      fontFamily: theme.typography.primary.semiBold ?? theme.typography.primary.medium,
    },
    secondaryButton: {
      borderRadius: 16,
      backgroundColor: theme.isDark
        ? theme.colors.palette.neutral300
        : theme.colors.palette.neutral200,
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
    roleContextBanner: {
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.palette.accent100,
      borderRadius: 14,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderWidth: 1,
      borderColor: theme.isDark ? theme.colors.palette.neutral700 : theme.colors.palette.accent200,
    },
    roleContextText: {
      fontSize: 14,
      color: theme.colors.text,
      fontFamily: theme.typography.primary.medium,
      textAlign: "center",
    },
    waitingText: {
      fontSize: 14,
      color: theme.colors.textDim,
      fontFamily: theme.typography.primary.medium,
      textAlign: "center",
      paddingVertical: theme.spacing.sm,
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
    fallbackCard: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.isDark ? theme.colors.palette.neutral700 : theme.colors.palette.neutral300,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.04)" : theme.colors.palette.neutral100,
      overflow: "hidden",
    },
    fallbackHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    fallbackCardTitle: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
      fontFamily: theme.typography.primary.medium,
    },
    fallbackBody: {
      paddingHorizontal: theme.spacing.md,
      paddingBottom: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    fallbackHint: {
      fontSize: 13,
      lineHeight: 19,
      color: theme.colors.textDim,
      fontFamily: theme.typography.primary.normal,
    },
    fallbackActions: {
      gap: theme.spacing.xs,
    },
    fallbackAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      borderRadius: 12,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.palette.neutral200,
    },
    fallbackActionText: {
      fontSize: 14,
      color: theme.colors.palette.primary500,
      fontFamily: theme.typography.primary.medium,
    },
  })
