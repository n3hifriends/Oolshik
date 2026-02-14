import React, { FC, useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native"
import * as Application from "expo-application"
import type {
  OolshikStackScreenProps,
  PaymentScanPayload,
  PaymentTaskContext,
} from "@/navigators/OolshikNavigator"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import * as Location from "expo-location"
import { OolshikApi, PaymentPayerRole } from "@/api/client"
import { useFocusEffect, useRoute } from "@react-navigation/native"
import { CameraView, useCameraPermissions } from "expo-camera"
import { useAppTheme } from "@/theme/context"
import type { Theme } from "@/theme/types"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTaskStore } from "@/store/taskStore"
import { loadString, saveString } from "@/utils/storage"
import { useAuth } from "@/context/AuthContext"
import { parseUpiQr } from "@/utils/upiQr"
import { useTranslation } from "react-i18next"

interface QrScannerScreenProps extends OolshikStackScreenProps<"QrScanner"> {}
type Params = { taskId?: string; amount?: number | null }

const defaultPaymentGuidelines = (t: (key: string) => string) => [
  t("payment:qr.defaultGuideline1"),
  t("payment:qr.defaultGuideline2"),
  t("payment:qr.defaultGuideline3"),
]

const USE_QR_DEMO = false
const DEMO_QR_PAYLOAD =
  "upi://pay?pa=raghav@ybl&pn=Raghav%20Khanna&am=1350.00&cu=INR&tn=Fuel%20reimbursement"
const DEMO_PAYMENT_REQUEST_ID = "demo-payment-req"
const DEMO_TASK_CONTEXT: PaymentTaskContext = {
  id: "demo-task",
  title: "Delivery • #DLV-2759",
  createdByName: "Netra Patil",
  createdByPhoneNumber: "+91 98765 43210",
}
const QR_DEVICE_ID_KEY = "payment.qr.device-id.v1"

function normalizeIdentifier(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim()
  if (!normalized) return null
  const lowered = normalized.toLowerCase()
  if (
    lowered === "unknown" ||
    lowered === "null" ||
    lowered === "undefined" ||
    lowered === "9774d56d682e549c"
  ) {
    return null
  }
  return normalized
}

function fallbackInstallationId() {
  return `${Platform.OS}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function buildAppVersionLabel() {
  const appId = normalizeIdentifier(Application.applicationId) ?? "oolshik"
  const version = normalizeIdentifier(Application.nativeApplicationVersion) ?? "unknown"
  const build = normalizeIdentifier(Application.nativeBuildVersion)
  return build ? `${appId}/${version} (${build})` : `${appId}/${version}`
}

async function resolveStableDeviceId(): Promise<string> {
  const cached = normalizeIdentifier(loadString(QR_DEVICE_ID_KEY))
  if (cached) return cached

  let nativeId: string | null = null
  if (Platform.OS === "android") {
    nativeId = normalizeIdentifier((Application as any).androidId)
  } else if (Platform.OS === "ios") {
    try {
      nativeId = normalizeIdentifier(await Application.getIosIdForVendorAsync())
    } catch {
      nativeId = null
    }
  }

  const resolved = nativeId
    ? `${Platform.OS}:native:${nativeId}`
    : `${Platform.OS}:install:${fallbackInstallationId()}`
  saveString(QR_DEVICE_ID_KEY, resolved)
  return resolved
}

export const QrScannerScreen: FC<QrScannerScreenProps> = ({ navigation }) => {
  const { t } = useTranslation()
  const { params } = useRoute<any>() as { params: Params }
  const [permission, requestPermission] = useCameraPermissions()
  const [processing, setProcessing] = useState(false)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const handledRef = useRef(false)
  const demoTriggeredRef = useRef(false)
  const { theme } = useAppTheme()
  const { userId } = useAuth()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => createStyles(theme), [theme])
  const tasks = useTaskStore((state) => state.tasks)
  const [cameraActive, setCameraActive] = useState(false)
  const appVersion = useMemo(() => buildAppVersionLabel(), [])
  const deviceIdRef = useRef<string | null>(null)

  const getDeviceId = useCallback(async () => {
    if (deviceIdRef.current) return deviceIdRef.current
    const resolved = await resolveStableDeviceId()
    deviceIdRef.current = resolved
    return resolved
  }, [])

  useEffect(() => {
    if (permission?.granted) {
      setStatusMessage(t("payment:qr.alignHint"))
      setErrorMessage(null)
    } else if (permission && !permission.granted && !permission.canAskAgain) {
      setStatusMessage(null)
      setErrorMessage(t("payment:qr.blockedCamera"))
    }
  }, [permission, t])

  useFocusEffect(
    useCallback(() => {
      handledRef.current = false
      setCameraActive(true)
      return () => {
        handledRef.current = true
        setCameraActive(false)
      }
    }, []),
  )

  function whoWillPayConfirmation(otherPayerLabel: string) {
    const label = otherPayerLabel?.trim().length ? otherPayerLabel.trim() : t("payment:qr.requester")
    return new Promise<"SELF" | "OTHER" | "CANCEL">((resolve) => {
      let resolved = false
      const safeResolve = (value: "SELF" | "OTHER" | "CANCEL") => {
        if (resolved) return
        resolved = true
        resolve(value)
      }

      Alert.alert(
        t("payment:qr.transactionFeeTitle"),
        t("payment:qr.transactionFeeBody"),
        [
          { text: t("payment:qr.me"), onPress: () => safeResolve("SELF") },
          { text: label, onPress: () => safeResolve("OTHER") },
          { text: t("payment:qr.cancel"), style: "cancel", onPress: () => safeResolve("CANCEL") },
        ],
        { cancelable: true, onDismiss: () => safeResolve("CANCEL") },
      )
    })
  }

  const onScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (processing || handledRef.current) return
      handledRef.current = true
      setProcessing(true)
      setStatusMessage(t("payment:qr.processing"))
      setErrorMessage(null)

      let hadError = false
      try {
        const parsed = parseUpiQr(data)
        const routeAmount =
          typeof params?.amount === "number" && Number.isFinite(params.amount) && params.amount > 0
            ? Number(params.amount.toFixed(2))
            : null
        const resolvedAmount =
          typeof parsed.amount === "number" && Number.isFinite(parsed.amount)
            ? parsed.amount
            : routeAmount
        let coords: { latitude: number; longitude: number } | undefined
        try {
          const locPerm = await Location.requestForegroundPermissionsAsync()
          if (locPerm.status === "granted") {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            })
            coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
          }
        } catch {
          // ignore location errors
        }

        const taskId = params?.taskId || "unknown-task-id"
        const task = tasks.find((t) => String(t.id) === String(taskId))

        const scanPayload: PaymentScanPayload = {
          rawPayload: data,
          format: parsed.format,
          payeeVpa: parsed.payeeVpa ?? null,
          payeeName: parsed.payeeName ?? null,
          txnRef: parsed.txnRef ?? null,
          mcc: parsed.mcc ?? null,
          merchantId: parsed.merchantId ?? null,
          amount: resolvedAmount,
          currency: parsed.currency ?? null,
          note: parsed.note ?? null,
          scanLocation: coords ? { lat: coords.latitude, lon: coords.longitude } : null,
          scannedAt: new Date().toISOString(),
          guidelines: defaultPaymentGuidelines(t),
        }

        const taskContext: PaymentTaskContext | undefined = task
          ? {
              id: task.id,
              title: task.title ?? task.description ?? null,
              createdByName: task.createdByName ?? null,
              createdByPhoneNumber: task.createdByPhoneNumber
                ? String(task.createdByPhoneNumber)
                : null,
            }
          : USE_QR_DEMO
            ? DEMO_TASK_CONTEXT
            : undefined

        const scannerIsRequester =
          !!task?.requesterId && !!userId && String(task.requesterId) === String(userId)
        const yourRole: PaymentPayerRole = scannerIsRequester ? "REQUESTER" : "HELPER"
        const otherRole: PaymentPayerRole = yourRole === "REQUESTER" ? "HELPER" : "REQUESTER"
        const requesterLabel =
          taskContext?.createdByName ?? task?.createdByName ?? t("payment:qr.requester")
        const otherPayerLabel = yourRole === "REQUESTER" ? t("payment:qr.helper") : requesterLabel
        const payerChoice = await whoWillPayConfirmation(otherPayerLabel)

        if (payerChoice === "CANCEL") {
          handledRef.current = false
          setProcessing(false)
          setStatusMessage(t("payment:qr.alignHint"))
          setErrorMessage(null)
          return
        }

        const payerRole: PaymentPayerRole = payerChoice === "SELF" ? yourRole : otherRole

        const body = {
          taskId,
          rawPayload: data,
          format: parsed.format,
          payeeVpa: parsed.payeeVpa ?? undefined,
          payeeName: parsed.payeeName ?? undefined,
          mcc: parsed.mcc ?? undefined,
          merchantId: parsed.merchantId ?? undefined,
          txnRef: parsed.txnRef ?? undefined,
          amount: resolvedAmount ?? undefined,
          currency: parsed.currency ?? undefined,
          note: parsed.note ?? undefined,
          scanLocation: coords ? { lat: coords.latitude, lon: coords.longitude } : undefined,
          appVersion,
          deviceId: await getDeviceId(),
          payerRole,
        }

        let requestId: string | undefined
        let upiIntentOverride: string | undefined

        if (!USE_QR_DEMO) {
          const res = await OolshikApi.createPaymentRequest(body)
          if (!res?.ok || !res.data) {
            const serverMessage =
              (res?.data as any)?.message ?? res?.problem ?? t("payment:qr.serverRejected")
            throw new Error(serverMessage)
          }
          const payload = res.data as any
          requestId = payload.id ?? payload?.snapshot?.id ?? undefined
          upiIntentOverride = payload.upiIntent ?? undefined
          if (!requestId) {
            throw new Error(t("payment:qr.missingRef"))
          }
        } else {
          upiIntentOverride = data.startsWith("upi://") ? data : undefined
        }

        if (payerChoice === "SELF") {
          setCameraActive(false)
          navigation.replace("PaymentPay", {
            taskId,
            paymentRequestId: requestId,
            scanPayload,
            taskContext,
            upiIntentOverride,
          })
          return
        }

        setStatusMessage(t("payment:qr.paymentGenerated"))
        const message = requestId
          ? t("payment:qr.shareRequestId", { name: otherPayerLabel, id: requestId })
          : t("payment:qr.paymentCaptured")
        Alert.alert(t("payment:qr.paymentRequestedTitle"), message, [
          {
            text: t("payment:qr.closeAndProceed"),
            onPress: () => navigation.goBack(),
          },
        ])
      } catch (e: any) {
        hadError = true
        setErrorMessage(e?.message ?? t("payment:qr.serverRejected"))
        Alert.alert(t("payment:qr.scanFailedTitle"), e.message ?? String(e))
        navigation.goBack()
      } finally {
        setProcessing(false)
        if (hadError) {
          handledRef.current = false
          setStatusMessage(null)
        } else {
          setStatusMessage(t("payment:qr.alignHint"))
          setErrorMessage(null)
        }
      }
    },
    [processing, params?.taskId, params?.amount, navigation, tasks, appVersion, getDeviceId, userId, t],
  )

  // make hardcoded demo scan on load
  useEffect(() => {
    if (USE_QR_DEMO && permission?.granted && !demoTriggeredRef.current) {
      demoTriggeredRef.current = true
      onScanned({ data: DEMO_QR_PAYLOAD })
    }
  }, [permission?.granted, onScanned])

  if (!permission) {
    // ask on first render
    requestPermission()
    return (
      <Screen style={$root} preset="fixed">
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.colors.palette.primary500} />
          <Text style={styles.centerStateText} text={t("payment:qr.checkingPermission")} />
        </View>
      </Screen>
    )
  }

  if (!permission.granted) {
    return (
      <Screen style={$root} preset="fixed">
        <View style={[styles.centerState, { paddingTop: insets.top }]}>
          <Text preset="heading" style={styles.permissionTitle} text={t("payment:qr.enableCamera")} />
          <Text style={styles.permissionMessage}>
            {t("payment:qr.blockedCamera")}
          </Text>
          <ButtonRow
            primaryText={
              permission.canAskAgain ? t("payment:qr.allowCamera") : t("task:create.openSettings")
            }
            onPrimaryPress={async () => {
              if (permission.canAskAgain) {
                await requestPermission()
              } else {
                Linking.openSettings()
              }
            }}
            secondaryText={t("payment:qr.cancel")}
            onSecondaryPress={() => navigation.goBack()}
            styles={styles}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen style={$root} contentContainerStyle={styles.screenContent} preset="fixed">
      <View style={styles.cameraWrapper}>
        <CameraView
          style={StyleSheet.absoluteFill}
          // only QR to reduce noise; remove/extend types if you want more symbologies
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          facing="back"
          enableTorch={torchEnabled}
          active={cameraActive}
          onBarcodeScanned={(evt) => {
            if (evt?.data) onScanned({ data: evt.data })
          }}
        />
        <View style={styles.cameraOverlay} pointerEvents="none">
          <View style={styles.overlayEdgeTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanWindow}>
              <View style={styles.cornerTL} />
              <View style={styles.cornerTR} />
              <View style={styles.cornerBL} />
              <View style={styles.cornerBR} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayEdgeBottom} />
        </View>
        <View style={[styles.topBar, { paddingTop: insets.top + theme.spacing.sm }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topButton}>
            <Text style={styles.topButtonText} text={t("payment:qr.cancelScan")} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTorchEnabled((prev) => !prev)}
            style={styles.topButton}
          >
            <Text
              style={styles.topButtonText}
              text={torchEnabled ? t("payment:qr.lightOff") : t("payment:qr.lightOn")}
            />
          </TouchableOpacity>
        </View>
        <View style={[styles.bottomCard, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <Text preset="heading" style={styles.bottomTitle} text={t("payment:qr.heading")} />
          <Text style={styles.bottomSubtitle}>
            {t("payment:qr.alignHint")}
          </Text>
          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.textAction}
              onPress={() => Alert.alert(t("payment:qr.manualSoonTitle"), t("payment:qr.manualSoonBody"))}
            >
              <Text style={styles.textActionLabel} text={t("payment:qr.manualEntry")} />
            </TouchableOpacity>
          </View>
        </View>
        {processing ? (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.palette.neutral100} />
            <Text style={styles.processingText} text={t("payment:qr.processingShort")} />
          </View>
        ) : null}
      </View>
    </Screen>
  )
}

const $root: ViewStyle = {
  flex: 1,
}

type ButtonRowProps = {
  primaryText: string
  secondaryText: string
  onPrimaryPress: () => void
  onSecondaryPress: () => void
  styles: ReturnType<typeof createStyles>
}

const ButtonRow: FC<ButtonRowProps> = ({
  primaryText,
  secondaryText,
  onPrimaryPress,
  onSecondaryPress,
  styles,
}) => {
  return (
    <View style={styles.permissionActions}>
      <TouchableOpacity onPress={onSecondaryPress} style={styles.permissionSecondary}>
        <Text style={styles.permissionSecondaryText} text={secondaryText} />
      </TouchableOpacity>
      <TouchableOpacity onPress={onPrimaryPress} style={styles.permissionPrimary}>
        <Text style={styles.permissionPrimaryText} text={primaryText} />
      </TouchableOpacity>
    </View>
  )
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screenContent: {
      flex: 1,
      backgroundColor: "black",
    },
    cameraWrapper: {
      flex: 1,
      position: "relative",
      backgroundColor: "black",
    },
    cameraOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "space-between",
    },
    overlayEdgeTop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    overlayEdgeBottom: {
      flex: 1.4,
      backgroundColor: "rgba(0,0,0,0.6)",
    },
    overlayMiddle: {
      flexDirection: "row",
      alignItems: "center",
    },
    overlaySide: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    scanWindow: {
      width: 260,
      height: 260,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      justifyContent: "space-between",
    },
    cornerTL: {
      position: "absolute",
      top: -2,
      left: -2,
      width: 46,
      height: 46,
      borderTopLeftRadius: 18,
      borderLeftWidth: 4,
      borderTopWidth: 4,
      borderColor: theme.colors.palette.neutral100,
    },
    cornerTR: {
      position: "absolute",
      top: -2,
      right: -2,
      width: 46,
      height: 46,
      borderTopRightRadius: 18,
      borderRightWidth: 4,
      borderTopWidth: 4,
      borderColor: theme.colors.palette.neutral100,
    },
    cornerBL: {
      position: "absolute",
      bottom: -2,
      left: -2,
      width: 46,
      height: 46,
      borderBottomLeftRadius: 18,
      borderLeftWidth: 4,
      borderBottomWidth: 4,
      borderColor: theme.colors.palette.neutral100,
    },
    cornerBR: {
      position: "absolute",
      bottom: -2,
      right: -2,
      width: 46,
      height: 46,
      borderBottomRightRadius: 18,
      borderRightWidth: 4,
      borderBottomWidth: 4,
      borderColor: theme.colors.palette.neutral100,
    },
    topBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      justifyContent: "space-between",
      paddingHorizontal: theme.spacing.lg,
    },
    topButton: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      backgroundColor: "rgba(0,0,0,0.35)",
      borderRadius: 999,
    },
    topButtonText: {
      color: theme.colors.palette.neutral100,
      fontFamily: theme.typography.primary.medium,
      fontSize: 14,
    },
    bottomCard: {
      position: "absolute",
      left: theme.spacing.lg,
      right: theme.spacing.lg,
      bottom: 0,
      backgroundColor: "rgba(12,12,12,0.82)",
      borderRadius: 24,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    bottomTitle: {
      color: theme.colors.palette.neutral100,
      fontSize: 20,
      fontFamily: theme.typography.primary.semiBold ?? theme.typography.primary.medium,
    },
    bottomSubtitle: {
      color: "rgba(255,255,255,0.72)",
      fontSize: 14,
      lineHeight: 20,
      fontFamily: theme.typography.primary.normal,
    },
    statusText: {
      color: theme.colors.palette.accent500,
      fontSize: 13,
      fontFamily: theme.typography.primary.medium,
    },
    errorText: {
      color: theme.colors.palette.angry500 ?? "#EF4444",
      fontSize: 13,
      fontFamily: theme.typography.primary.medium,
    },
    bottomActions: {
      marginTop: theme.spacing.sm,
    },
    textAction: {
      paddingVertical: theme.spacing.xs,
    },
    textActionLabel: {
      textAlign: "center",
      fontSize: 14,
      color: theme.colors.palette.primary300,
      fontFamily: theme.typography.primary.medium,
    },
    processingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0,0,0,0.55)",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
    },
    processingText: {
      color: theme.colors.palette.neutral100,
      fontSize: 16,
      fontFamily: theme.typography.primary.medium,
    },
    centerState: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
    },
    centerStateText: {
      fontSize: 14,
      color: theme.colors.textDim,
      fontFamily: theme.typography.primary.normal,
      textAlign: "center",
    },
    permissionTitle: {
      textAlign: "center",
      color: theme.colors.text,
    },
    permissionMessage: {
      textAlign: "center",
      fontSize: 15,
      color: theme.colors.textDim,
      lineHeight: 22,
      fontFamily: theme.typography.primary.normal,
    },
    permissionActions: {
      marginTop: theme.spacing.lg,
      width: "100%",
      gap: theme.spacing.sm,
    },
    permissionSecondary: {
      paddingVertical: theme.spacing.sm,
      borderRadius: 16,
      backgroundColor: theme.colors.palette.neutral200,
    },
    permissionSecondaryText: {
      textAlign: "center",
      fontSize: 16,
      color: theme.colors.text,
      fontFamily: theme.typography.primary.medium,
    },
    permissionPrimary: {
      paddingVertical: theme.spacing.sm,
      borderRadius: 16,
      backgroundColor: theme.colors.palette.primary500,
    },
    permissionPrimaryText: {
      textAlign: "center",
      fontSize: 16,
      color: theme.colors.palette.neutral100,
      fontFamily: theme.typography.primary.semiBold ?? theme.typography.primary.medium,
    },
  })
