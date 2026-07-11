import React, { useCallback, useMemo, useState } from "react"
import { ActivityIndicator, Alert, Linking, Modal, Pressable, StyleSheet, View } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { CameraView, useCameraPermissions } from "expo-camera"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import type { OolshikStackScreenProps } from "@/navigators/OolshikNavigator"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { TextField } from "@/components/TextField"
import { SectionCard } from "@/components/SectionCard"
import {
  OolshikApi,
  type PaymentProfileEditApiResponse,
  type PaymentProfileSourceType,
} from "@/api/client"
import { useAppTheme } from "@/theme/context"
import type { Theme } from "@/theme/types"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/context/AuthContext"
import { parseUpiQr } from "@/utils/upiQr"
import { isValidUpiId, maskUpiId, normalizeUpiId } from "@/utils/paymentProfile"
import { breadcrumb, setPaymentContext, clearPaymentContext } from "@/utils/crashReporting"

type Props = OolshikStackScreenProps<"PaymentProfile">

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "").slice(-10)
  if (digits.length < 5) return phone
  return `+91 ${"•".repeat(digits.length - 5)}${digits.slice(-5)}`
}

export default function PaymentProfileScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const { theme } = useAppTheme()
  const { userPhone } = useAuth()
  const styles = useMemo(() => createStyles(theme), [theme])
  const insets = useSafeAreaInsets()
  const entryPoint = route.params?.entryPoint ?? "profile"
  const required = route.params?.required ?? false

  const [permission, requestPermission] = useCameraPermissions()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [profile, setProfile] = useState<PaymentProfileEditApiResponse>({ hasProfile: false })
  const [upiId, setUpiId] = useState("")
  const [payeeLabel, setPayeeLabel] = useState("")
  const [sourceType, setSourceType] = useState<PaymentProfileSourceType>("MANUAL")
  const [error, setError] = useState<string | null>(null)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [pendingScan, setPendingScan] = useState<{ upiId: string; payeeName: string } | null>(null)

  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const response = await OolshikApi.getMyPaymentProfileForEdit()
      if (response.ok && response.data) {
        setProfile(response.data)
        if (response.data.hasProfile) {
          setUpiId(response.data.upiId ?? "")
          setPayeeLabel(response.data.payeeLabel ?? "")
          setSourceType(response.data.sourceType ?? "MANUAL")
        }
        setPaymentContext({
          paymentContext: "profile_setup",
          paymentFlow: entryPoint,
          paymentStatus: response.data.hasProfile ? "has_profile" : "no_profile",
        })
      } else {
        setProfile({ hasProfile: false })
        setPaymentContext({ paymentContext: "profile_setup", paymentFlow: entryPoint, paymentStatus: "no_profile" })
      }
    } finally {
      setLoading(false)
    }
  }, [entryPoint])

  useFocusEffect(
    useCallback(() => {
      void loadProfile()
      return () => clearPaymentContext()
    }, [loadProfile]),
  )

  const handleSave = useCallback(async () => {
    const normalizedUpiId = normalizeUpiId(upiId)
    if (!isValidUpiId(normalizedUpiId)) {
      setError(t("payment:profile.invalidUpi"))
      return
    }

    if (payeeLabel.trim().length > 50) {
      setError(t("payment:profile.nameTooLong"))
      return
    }

    if (!userPhone) {
      setError(t("payment:profile.mobileRequiredToSave"))
      return
    }

    setError(null)
    setSaving(true)
    const saveAction = profile.hasProfile ? "update" : "add"
    breadcrumb(`payment:profile_save_started action=${saveAction} source=${sourceType.toLowerCase()}`)
    try {
      const body = {
        upiId: normalizedUpiId,
        payeeLabel: payeeLabel.trim() || undefined,
        sourceType,
      }
      const response = profile.hasProfile
        ? await OolshikApi.updatePaymentProfile(body)
        : await OolshikApi.createPaymentProfile(body)

      if (!response.ok || !response.data) {
        const message =
          (response.data as { message?: string } | undefined)?.message ??
          t("payment:profile.saveFailed")
        throw new Error(message)
      }

      breadcrumb(`payment:profile_saved action=${saveAction}`)
      setProfile(response.data)
      setUpiId(response.data.upiId ?? normalizedUpiId)
      setPayeeLabel(response.data.payeeLabel ?? payeeLabel.trim())

      const closeAfterSave = entryPoint !== "profile"
      Alert.alert(
        t("payment:profile.savedTitle"),
        closeAfterSave ? t("payment:profile.savedBodyShort") : t("payment:profile.savedBody"),
        [
          {
            text: t("common:ok"),
            onPress: () => {
              if (closeAfterSave) {
                navigation.goBack()
              }
            },
          },
        ],
      )
    } catch (err) {
      breadcrumb(`payment:profile_save_failed action=${saveAction}`)
      const message = err instanceof Error ? err.message : t("payment:profile.saveFailed")
      setError(message)
    } finally {
      setSaving(false)
    }
  }, [entryPoint, navigation, payeeLabel, profile.hasProfile, sourceType, t, upiId])

  const handleDelete = useCallback(() => {
    Alert.alert(
      t("payment:profile.deleteTitle"),
      t("payment:profile.deleteBody"),
      [
        { text: t("common:cancel"), style: "cancel" },
        {
          text: t("payment:profile.deleteCta"),
          style: "destructive",
          onPress: async () => {
            setDeleting(true)
            try {
              await OolshikApi.deletePaymentProfile()
              setProfile({ hasProfile: false })
              setUpiId("")
              setPayeeLabel("")
              setSourceType("MANUAL")
            } finally {
              setDeleting(false)
            }
          },
        },
      ],
      { cancelable: true },
    )
  }, [t])

  const openScanner = useCallback(async () => {
    setScannerError(null)
    if (!permission?.granted) {
      const next = await requestPermission()
      if (!next.granted) {
        Alert.alert(t("payment:profile.cameraTitle"), t("payment:profile.cameraBody"), [
          { text: t("common:cancel"), style: "cancel" },
          { text: t("task:create.openSettings"), onPress: () => Linking.openSettings() },
        ])
        return
      }
    }
    breadcrumb("payment:qr_scanner_opened")
    setScannerOpen(true)
  }, [permission?.granted, requestPermission, t])

  const onBarcodeScanned = useCallback(
    ({ data }: { data: string }) => {
      const parsed = parseUpiQr(data)
      if (!parsed.payeeVpa) {
        breadcrumb("payment:qr_parse_failed kind=not_upi")
        setScannerError(t("payment:profile.scanUnsupported"))
        return
      }
      breadcrumb("payment:qr_parsed")
      const extractedUpiId = normalizeUpiId(parsed.payeeVpa)
      setScannerOpen(false)
      setScannerError(null)
      setPendingScan({ upiId: extractedUpiId, payeeName: parsed.payeeName ?? "" })
    },
    [t],
  )

  const applyPendingScan = useCallback(() => {
    if (!pendingScan) return
    setUpiId(pendingScan.upiId)
    setPayeeLabel((prev) => prev || pendingScan.payeeName || "")
    setSourceType("QR_EXTRACTED")
    setPendingScan(null)
  }, [pendingScan])

  const title =
    entryPoint === "onboarding"
      ? t("payment:profile.onboardingTitle")
      : required
        ? t("payment:profile.requiredTitle")
        : t("payment:profile.title")
  const subtitle =
    entryPoint === "onboarding"
      ? t("payment:profile.onboardingBody")
      : required
        ? t("payment:profile.requiredBody")
        : t("payment:profile.body")

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={styles.content}
    >
      <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backLink}>
        <Text text={`← ${t("common:back")}`} />
      </Pressable>

      <View style={styles.header}>
        <Text preset="heading" text={title} />
        <Text style={styles.headerBody}>{subtitle}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.colors.palette.primary500} />
          <Text text={t("payment:profile.loading")} />
        </View>
      ) : null}

      {!loading && profile.hasProfile ? (
        <SectionCard style={styles.card}>
          <Text preset="subheading" text={t("payment:profile.currentTitle")} />
          <View style={styles.summaryRow}>
            <Text style={styles.label} text={t("payment:profile.currentUpi")} />
            <Text style={styles.value} text={profile.maskedUpiId ?? "—"} />
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.label} text={t("payment:profile.currentName")} />
            <Text style={styles.value} text={profile.payeeLabel ?? t("payment:profile.notAdded")} />
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.label} text={t("payment:profile.currentSource")} />
            <Text
              style={styles.value}
              text={
                profile.sourceType === "QR_EXTRACTED"
                  ? t("payment:profile.sourceQr")
                  : t("payment:profile.sourceManual")
              }
            />
          </View>
        </SectionCard>
      ) : null}

      <SectionCard style={styles.card}>
        <Text
          preset="subheading"
          text={profile.hasProfile ? t("payment:profile.editTitle") : t("payment:profile.addTitle")}
        />
        <Text style={styles.helperText}>{t("payment:profile.helper")}</Text>

        {userPhone ? (
          <View style={[styles.summaryRow, styles.fieldWrap]}>
            <Text style={styles.label} text={t("payment:profile.registeredMobileLabel")} />
            <Text style={styles.value} text={maskPhone(userPhone)} />
          </View>
        ) : null}

        <View style={styles.fieldWrap}>
          <TextField
            label={t("payment:profile.upiLabel")}
            placeholder="name@bank"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={upiId}
            onChangeText={(value) => {
              setUpiId(value)
              setSourceType("MANUAL")
            }}
            helper={error ?? t("payment:profile.upiHint")}
            status={error ? "error" : undefined}
          />
          {userPhone ? (
            <Text style={styles.bindingNote}>{t("payment:profile.registeredMobileNote")}</Text>
          ) : null}
        </View>

        <View style={styles.fieldWrap}>
          <TextField
            label={t("payment:profile.nameLabel")}
            placeholder={t("payment:profile.namePlaceholder")}
            value={payeeLabel}
            onChangeText={setPayeeLabel}
            autoCapitalize="words"
            maxLength={50}
            helper={payeeLabel.length > 0 ? `${payeeLabel.length}/50 · ${t("payment:profile.nameHint")}` : t("payment:profile.nameHint")}
          />
        </View>

        <View style={styles.actions}>
          <Button
            text={t("payment:profile.scanCta")}
            onPress={openScanner}
            style={styles.secondaryButton}
            textStyle={styles.secondaryButtonText}
          />
          <Button
            text={
              saving
                ? t("payment:profile.saving")
                : profile.hasProfile
                  ? t("payment:profile.updateCta")
                  : t("payment:profile.addCta")
            }
            onPress={handleSave}
            disabled={saving}
            style={styles.primaryButton}
            textStyle={styles.primaryButtonText}
          />
        </View>

        <Text style={styles.inlineNote}>{t("payment:profile.inlineNote")}</Text>
      </SectionCard>

      {pendingScan ? (
        <SectionCard style={styles.card}>
          <Text preset="subheading" text={t("payment:profile.scanReviewTitle")} />
          <View style={styles.summaryRow}>
            <Text style={styles.label} text={t("payment:profile.scanReviewUpi")} />
            <Text style={styles.value} text={maskUpiId(pendingScan.upiId)} />
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.label} text={t("payment:profile.scanReviewName")} />
            <Text
              style={styles.value}
              text={pendingScan.payeeName || t("payment:profile.scanReviewNameNone")}
            />
          </View>
          {payeeLabel &&
          pendingScan.payeeName &&
          pendingScan.payeeName.trim().toLowerCase() !== payeeLabel.trim().toLowerCase() ? (
            <Text style={styles.scanReviewWarning}>
              {t("payment:profile.scanReviewNameMismatch")}
            </Text>
          ) : null}
          <View style={styles.actions}>
            <Button
              text={t("payment:profile.scanReviewDiscard")}
              onPress={() => setPendingScan(null)}
              style={styles.secondaryButton}
              textStyle={styles.secondaryButtonText}
            />
            <Button
              text={t("payment:profile.scanReviewApply")}
              onPress={applyPendingScan}
              style={styles.primaryButton}
              textStyle={styles.primaryButtonText}
            />
          </View>
        </SectionCard>
      ) : null}

      {profile.hasProfile && entryPoint === "profile" ? (
        <View style={styles.actions}>
          <Button
            text={deleting ? t("payment:profile.deleting") : t("payment:profile.deleteCta")}
            onPress={handleDelete}
            disabled={deleting}
            style={styles.destructiveButton}
            textStyle={styles.destructiveText}
          />
        </View>
      ) : null}

      {entryPoint === "onboarding" && !required ? (
        <Button
          text={t("payment:profile.skipCta")}
          onPress={() => navigation.goBack()}
          style={styles.skipButton}
          textStyle={styles.skipButtonText}
        />
      ) : null}

      <Modal
        visible={scannerOpen}
        animationType="slide"
        onRequestClose={() => setScannerOpen(false)}
      >
        <View style={styles.scannerRoot}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={onBarcodeScanned}
          />
          <View style={styles.scannerOverlay} pointerEvents="none">
            <View style={styles.scannerWindow} />
          </View>
          <View style={[styles.scannerCard, { paddingBottom: theme.spacing.lg + insets.bottom }]}>
            <Text
              preset="heading"
              text={t("payment:profile.scanTitle")}
              style={styles.scannerTitle}
            />
            <Text style={styles.scannerBody}>{t("payment:profile.scanBody")}</Text>
            {scannerError ? <Text style={styles.scannerError}>{scannerError}</Text> : null}
            <View style={styles.actions}>
              <Button
                text={t("payment:profile.closeScanner")}
                onPress={() => setScannerOpen(false)}
                style={styles.scannerButton}
                textStyle={styles.scannerButtonText}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    actions: {
      flexDirection: "row",
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    backLink: {
      alignSelf: "flex-start",
    },
    card: {
      gap: theme.spacing.sm,
    },
    content: {
      padding: theme.spacing.md,
      gap: theme.spacing.lg,
    },
    destructiveButton: {
      backgroundColor: theme.colors.error,
      borderRadius: 12,
      flex: 1,
      minHeight: 46,
    },
    destructiveText: {
      color: theme.colors.palette.neutral100,
    },
    fieldWrap: {
      marginTop: theme.spacing.md,
    },
    header: {
      gap: theme.spacing.xs,
    },
    headerBody: {
      color: theme.colors.textDim,
      lineHeight: 21,
    },
    helperText: {
      color: theme.colors.textDim,
      lineHeight: 20,
    },
    bindingNote: {
      color: theme.colors.textDim,
      fontSize: 12,
      lineHeight: 18,
      marginTop: theme.spacing.xs,
    },
    inlineNote: {
      color: theme.colors.textDim,
      fontSize: 12,
      lineHeight: 18,
      marginTop: theme.spacing.sm,
    },
    label: {
      color: theme.colors.textDim,
      fontSize: 12,
    },
    loadingState: {
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingVertical: theme.spacing.xl,
    },
    primaryButton: {
      borderRadius: 12,
      flex: 1,
      minHeight: 46,
      backgroundColor: theme.colors.palette.primary500,
    },
    primaryButtonText: {
      color: theme.colors.palette.neutral100,
    },
    scannerBody: {
      color: "rgba(255,255,255,0.78)",
      lineHeight: 20,
      flexShrink: 1,
    },
    scannerButton: {
      borderRadius: 12,
      flex: 1,
      minHeight: 46,
      backgroundColor: "rgba(255,255,255,0.14)",
    },
    scannerButtonText: {
      color: "#FFFFFF",
    },
    scannerCard: {
      backgroundColor: "rgba(11,12,16,0.92)",
      borderRadius: 24,
      bottom: 0,
      gap: theme.spacing.sm,
      left: theme.spacing.lg,
      padding: theme.spacing.lg,
      position: "absolute",
      right: theme.spacing.lg,
    },
    scannerError: {
      color: "#FCA5A5",
      fontSize: 13,
    },
    scanReviewWarning: {
      color: theme.colors.error,
      fontSize: 13,
      lineHeight: 19,
    },
    scannerOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    scannerRoot: {
      backgroundColor: "black",
      flex: 1,
      position: "relative",
    },
    scannerTitle: {
      color: theme.colors.palette.neutral100,
    },
    scannerWindow: {
      borderColor: "rgba(255,255,255,0.85)",
      borderRadius: 28,
      borderWidth: 2,
      height: 260,
      width: 260,
    },
    secondaryButton: {
      borderRadius: 12,
      flex: 1,
      minHeight: 46,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.10)" : theme.colors.palette.neutral200,
    },
    secondaryButtonText: {
      color: theme.colors.text,
    },
    skipButton: {
      borderRadius: 12,
      minHeight: 46,
      backgroundColor: theme.isDark ? "rgba(255,255,255,0.06)" : theme.colors.palette.neutral200,
    },
    skipButtonText: {
      color: theme.colors.text,
    },
    summaryRow: {
      gap: 4,
    },
    value: {
      fontFamily: theme.typography.primary.medium,
    },
  })
