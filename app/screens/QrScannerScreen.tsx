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
import type {
  OolshikStackScreenProps,
  PaymentScanPayload,
  PaymentTaskContext,
} from "@/navigators/OolshikNavigator"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import * as Location from "expo-location"
import { OolshikApi } from "@/api/client"
import { useFocusEffect, useRoute } from "@react-navigation/native"
import { CameraView, useCameraPermissions } from "expo-camera"
import { useAppTheme } from "@/theme/context"
import type { Theme } from "@/theme/types"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useTaskStore } from "@/store/taskStore"

interface QrScannerScreenProps extends OolshikStackScreenProps<"QrScanner"> {}
type Params = { taskId?: string }

const DEFAULT_PAYMENT_GUIDELINES = [
  "Transfers are only accepted from the registered bank account.",
  "If your UPI app does not redirect back, upload the proof in Payments.",
  "For discrepancies contact support before marking the request as paid.",
]

const USE_QR_DEMO = true
const DEMO_QR_PAYLOAD =
  "upi://pay?pa=raghav@ybl&pn=Raghav%20Khanna&am=1350.00&cu=INR&tn=Fuel%20reimbursement"
const DEMO_PAYMENT_REQUEST_ID = "demo-payment-req"
const DEMO_TASK_CONTEXT: PaymentTaskContext = {
  id: "demo-task",
  title: "Delivery • #DLV-2759",
  createdByName: "Netra Patil",
  createdByPhoneNumber: "+91 98765 43210",
}

export const QrScannerScreen: FC<QrScannerScreenProps> = ({ navigation }) => {
  const { params } = useRoute<any>() as { params: Params }
  const [permission, requestPermission] = useCameraPermissions()
  const [processing, setProcessing] = useState(false)
  const [torchEnabled, setTorchEnabled] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const handledRef = useRef(false)
  const demoTriggeredRef = useRef(false)
  const { theme } = useAppTheme()
  const insets = useSafeAreaInsets()
  const styles = useMemo(() => createStyles(theme), [theme])
  const tasks = useTaskStore((state) => state.tasks)

  useEffect(() => {
    if (permission?.granted) {
      setStatusMessage("Align the QR code inside the frame")
      setErrorMessage(null)
    } else if (permission && !permission.granted && !permission.canAskAgain) {
      setStatusMessage(null)
      setErrorMessage("Camera access is blocked. Enable it in Settings to continue.")
    }
  }, [permission])

  function parseUpiUri(uri: string) {
    const qIndex = uri.indexOf("?")
    if (qIndex < 0) {
      return { format: "unknown" as const, raw: uri }
    }

    const query = uri.slice(qIndex + 1)
    const params: Record<string, string> = Object.create(null)

    const decode = (value: string) => {
      if (value.length === 0) return ""
      if (value.indexOf("+") !== -1) {
        value = value.split("+").join(" ")
      }
      try {
        return decodeURIComponent(value)
      } catch {
        return value
      }
    }

    let start = 0
    for (let i = 0; i <= query.length; i++) {
      if (i === query.length || query.charCodeAt(i) === 38 /* & */) {
        if (i > start) {
          const segment = query.slice(start, i)
          const eqIdx = segment.indexOf("=")
          const key = eqIdx === -1 ? segment : segment.slice(0, eqIdx)
          const rawValue = eqIdx === -1 ? "" : segment.slice(eqIdx + 1)
          params[decode(key)] = decode(rawValue)
        }
        start = i + 1
      }
    }

    const payeeVpa = params.pa?.trim()
    const payeeName = params.pn?.trim()
    const currency = params.cu?.trim()
    const note = params.tn?.trim()
    const amountRaw = params.am?.trim()
    const amountNumber = amountRaw && amountRaw.length > 0 ? Number(amountRaw) : Number.NaN

    return {
      format: "upi-uri" as const,
      raw: uri,
      payeeVpa: payeeVpa && payeeVpa.length > 0 ? payeeVpa : null,
      payeeName: payeeName && payeeName.length > 0 ? payeeName : null,
      amount: Number.isFinite(amountNumber) ? amountNumber : null,
      currency: currency && currency.length > 0 ? currency : "INR",
      note: note && note.length > 0 ? note : null,
    }
  }

  useFocusEffect(
    useCallback(() => {
      handledRef.current = false
      return () => {
        handledRef.current = true
      }
    }, []),
  )

  function whoWillPayConfirmation(payerLabel: string) {
    const label = payerLabel?.trim().length ? payerLabel.trim() : "Neta"
    return new Promise<"You" | "Neta" | "Cancel">((resolve) => {
      let resolved = false
      const safeResolve = (value: "You" | "Neta" | "Cancel") => {
        if (resolved) return
        resolved = true
        resolve(value)
      }

      Alert.alert(
        "Transaction fee",
        "Who will pay the transaction fee?",
        [
          { text: "You", onPress: () => safeResolve("You") },
          { text: label, onPress: () => safeResolve("Neta") },
          { text: "Cancel", style: "cancel", onPress: () => safeResolve("Cancel") },
        ],
        { cancelable: true, onDismiss: () => safeResolve("Cancel") },
      )
    })
  }

  const onScanned = useCallback(
    async ({ data }: { data: string }) => {
      if (processing || handledRef.current) return
      handledRef.current = true
      setProcessing(true)
      setStatusMessage("Processing QR code…")
      setErrorMessage(null)

      let hadError = false
      try {
        const parsed = data.startsWith("upi://")
          ? parseUpiUri(data)
          : { format: "unknown" as const, raw: data }
        let coords: { latitude: number; longitude: number } | undefined
        const locPerm = await Location.requestForegroundPermissionsAsync()
        if (locPerm.status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          })
          coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude }
        }

        const taskId = params?.taskId || "unknown-task-id"
        const task = tasks.find((t) => String(t.id) === String(taskId))

        const scanPayload: PaymentScanPayload = {
          rawPayload: data,
          format: parsed.format,
          payeeVpa: (parsed as any).payeeVpa ?? null,
          payeeName: (parsed as any).payeeName ?? null,
          amount: typeof (parsed as any).amount === "number" ? (parsed as any).amount : null,
          currency: (parsed as any).currency ?? null,
          note: (parsed as any).note ?? null,
          scanLocation: coords ? { lat: coords.latitude, lon: coords.longitude } : null,
          scannedAt: new Date().toISOString(),
          guidelines: DEFAULT_PAYMENT_GUIDELINES,
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

        const netaLabel = taskContext?.createdByName ?? task?.createdByName ?? "Neta"
        const payerChoice = await whoWillPayConfirmation(netaLabel)

        if (payerChoice === "You") {
          setProcessing(false)
          setStatusMessage("Align the QR code inside the frame")
          setErrorMessage(null)
          navigation.navigate("PaymentPay", {
            taskId,
            paymentRequestId: USE_QR_DEMO ? DEMO_PAYMENT_REQUEST_ID : undefined,
            scanPayload,
            taskContext,
          })
          return
        }

        if (payerChoice === "Cancel") {
          handledRef.current = false
          setProcessing(false)
          setStatusMessage("Align the QR code inside the frame")
          setErrorMessage(null)
          return
        }

        const body = {
          taskId,
          rawPayload: data,
          format: parsed.format,
          payeeVpa: (parsed as any).payeeVpa ?? undefined,
          payeeName: (parsed as any).payeeName ?? undefined,
          amount: (parsed as any).amount ?? undefined,
          currency: (parsed as any).currency ?? undefined,
          note: (parsed as any).note ?? undefined,
          scanLocation: coords ? { lat: coords.latitude, lon: coords.longitude } : undefined,
          appVersion: `rn-0.73-${Platform.OS}`,
          deviceId: "device-qr",
        }

        const res = await OolshikApi.createPaymentRequest(body)
        if (res?.ok) {
          const payload = (res.data as any) ?? {}
          const requestId =
            payload.id ?? payload.requestId ?? payload.data?.id ?? payload.data?.requestId ?? null
          setStatusMessage("Payment request generated")
          Alert.alert(
            "Payment requested",
            requestId ? `Share this ID with Neta:\n${requestId}` : "Payment request captured.",
            [
              {
                text: "Close & proceed",
                onPress: () => navigation.goBack(),
              },
            ],
          )
        } else {
          const serverMessage = (res?.data as any)?.message ?? "Server did not accept this QR code."
          throw new Error(serverMessage)
        }
      } catch (e: any) {
        hadError = true
        setErrorMessage(e?.message ?? "Unable to process this QR code.")
        Alert.alert("Scan failed", e.message ?? String(e))
      } finally {
        setProcessing(false)
        if (hadError) {
          handledRef.current = false
          setStatusMessage(null)
        } else {
          setStatusMessage("Align the QR code inside the frame")
          setErrorMessage(null)
        }
      }
    },
    [processing, params?.taskId, navigation, tasks],
  )

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
          <Text style={styles.centerStateText} text="Checking camera permission…" />
        </View>
      </Screen>
    )
  }

  if (!permission.granted) {
    return (
      <Screen style={$root} preset="fixed">
        <View style={[styles.centerState, { paddingTop: insets.top }]}>
          <Text preset="heading" style={styles.permissionTitle} text="Enable your camera" />
          <Text style={styles.permissionMessage}>
            We need camera access to scan payment QR codes securely. You can enable it from system
            settings or grant it now.
          </Text>
          <ButtonRow
            primaryText={permission.canAskAgain ? "Allow camera" : "Open settings"}
            onPrimaryPress={async () => {
              if (permission.canAskAgain) {
                await requestPermission()
              } else {
                Linking.openSettings()
              }
            }}
            secondaryText="Not now"
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
            <Text style={styles.topButtonText} text="Cancel" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTorchEnabled((prev) => !prev)}
            style={styles.topButton}
          >
            <Text style={styles.topButtonText} text={torchEnabled ? "Light off" : "Light on"} />
          </TouchableOpacity>
        </View>
        <View style={[styles.bottomCard, { paddingBottom: insets.bottom + theme.spacing.lg }]}>
          <Text preset="heading" style={styles.bottomTitle} text="Scan QR to request payment" />
          <Text style={styles.bottomSubtitle}>
            Place the code inside the frame. We’ll attach the location and task details
            automatically.
          </Text>
          {statusMessage ? <Text style={styles.statusText}>{statusMessage}</Text> : null}
          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={styles.textAction}
              onPress={() => Alert.alert("Coming soon", "Manual entry will be available soon.")}
            >
              <Text style={styles.textActionLabel} text="Enter reference code manually" />
            </TouchableOpacity>
          </View>
        </View>
        {processing ? (
          <View style={styles.processingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.palette.neutral100} />
            <Text style={styles.processingText} text="Processing…" />
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
