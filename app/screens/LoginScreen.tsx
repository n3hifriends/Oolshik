import { FC, useEffect, useMemo, useRef, useState } from "react"
import { TextInput, TextStyle, View, ViewStyle, Pressable } from "react-native"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { OolshikApi } from "@/api"
import { setLoginTokens } from "@/api/client"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/AppNavigator"
import type { ThemedStyle } from "@/theme/types"
import { useAppTheme } from "@/theme/context"
import { getAuth, signInWithPhoneNumber, FirebaseAuthTypes } from "@react-native-firebase/auth"

interface LoginScreenProps extends AppStackScreenProps<"Login"> {}

function toE164(raw: string) {
  let p = raw.trim().replace(/\s+/g, "")
  if (p.startsWith("0")) p = p.slice(1)
  if (!p.startsWith("+")) p = `+91${p}`
  return p
}

// A large, tap-to-focus 6-box OTP input optimized for accessibility
function OtpBoxes({
  value,
  length = 6,
  onChange,
  editable,
}: {
  value: string
  length?: number
  onChange: (v: string) => void
  editable: boolean
}) {
  const inputRef = useRef<TextInput>(null)
  const { theme } = useAppTheme()
  const { spacing, colors } = theme

  const digits = Array.from({ length }).map((_, i) => value[i] ?? "")

  return (
    <Pressable
      onPress={() => inputRef.current?.focus()}
      accessibilityRole="button"
      style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.sm }}
    >
      {digits.map((d, i) => (
        <View
          key={i}
          style={{
            width: 46,
            height: 56,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.palette.neutral400,
            backgroundColor: editable ? colors.palette.neutral100 : colors.palette.neutral200,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text text={d ? d : ""} weight="bold" style={{ fontSize: 20 }} />
        </View>
      ))}

      {/* Hidden receiver */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(t) => onChange(t.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={length}
        style={{ position: "absolute", opacity: 0, height: 0, width: 0 }}
        editable={editable}
      />
    </Pressable>
  )
}

export const LoginScreen: FC<LoginScreenProps> = ({ navigation }) => {
  // Mandatory phone & OTP
  const [phone, setPhone] = useState("") // 10 digits (India-style)
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [triedContinue, setTriedContinue] = useState(false)
  const [loading, setLoading] = useState<"send" | "verify" | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const [showEmail, setShowEmail] = useState(false)
  const [confirm, setConfirm] = useState<FirebaseAuthTypes.ConfirmationResult | null>(null)
  const [pendingTokens, setPendingTokens] = useState<{
    accessToken: string
    refreshToken: string
  } | null>(null)

  const { setAuthEmail, authEmail, setAuthToken, setUserId, setUserName, validationError } =
    useAuth()

  const { themed, theme } = useAppTheme()
  const { spacing, colors } = theme

  // Clear email on mount (optional field)
  useEffect(() => {
    setAuthEmail("")
  }, [setAuthEmail])

  // Validation
  const phoneError = useMemo(() => {
    const t = phone.replace(/\D/g, "")
    if (t.length === 0) return "Can't be blank"
    if (t.length < 10) return "must be 10 digits"
    return ""
  }, [phone])

  const nameError = useMemo(() => {
    return displayName.trim().length === 0 ? "Can't be blank" : ""
  }, [displayName])

  const withTimeout = <T,>(p: Promise<T>, ms = 30000) =>
    Promise.race([
      p,
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("OTP request timed out")), ms)),
    ])

  // Real services
  async function sendOtp(p: string) {
    try {
      // Use React Native Firebase phone auth
      const auth = getAuth()
      const confirmation = await withTimeout(signInWithPhoneNumber(auth, toE164(p)), 30000)
      if (!confirmation) {
        return { ok: false, error: "Failed to get confirmation result" }
      }
      // Return a shape compatible with existing onSendOtp logic
      return { ok: true, data: { confirmation } }
    } catch (err: any) {
      // Handle common cases
      const msg = String(err?.message || err)
      if (msg.includes("blocked") || msg.includes("17010")) {
        // Show a precise message so you know it's anti-abuse
        throw new Error(
          "Firebase has temporarily blocked OTP from this device. Use a test number or try a fresh emulator/real device.",
        )
      }
      throw err
    }
  }

  async function verifyOtp(p: string, code: string) {
    if (!confirm) return { ok: false } as any
    const cred = await confirm.confirm(code.trim())
    if (!cred) {
      throw new Error("Credential is null")
    }
    const user = cred.user
    const idToken = await user.getIdToken(true) // fresh ID token
    // Align to your existing token handling contract
    return {
      ok: true,
      data: {
        accessToken: idToken,
        refreshToken: undefined,
        uid: user.uid,
        phone: user.phoneNumber,
      },
    }
  }

  // Resend timer
  useEffect(() => {
    if (resendIn <= 0) return
    const id = setInterval(() => setResendIn((s) => (s > 0 ? s - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [resendIn])

  const onSendOtp = async () => {
    if (phoneError) return
    setLoading("send")
    const res = await sendOtp(phone)
    setLoading(null)
    if (res.ok && res.data?.confirmation) {
      setConfirm(res.data.confirmation as FirebaseAuthTypes.ConfirmationResult)
      setOtpSent(true)
      setOtp("")
      setOtpVerified(false)
      setResendIn(30)
    } else {
      alert("Failed to send OTP")
    }
  }

  const onVerifyOtp = async (code?: string) => {
    if (!otpSent || loading === "verify") return
    const entered = (code ?? otp).trim()
    if (!/^\d{6}$/.test(entered)) return
    setLoading("verify")
    const res = await verifyOtp(phone, entered)
    setLoading(null)
    if (res.ok && res.data?.accessToken) {
      // Do not persist tokens here to avoid auto-navigation.
      setPendingTokens({
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken as any,
      })
      setOtpVerified(true)
    } else {
      alert("Invalid OTP")
    }
  }

  const onContinue = async () => {
    setTriedContinue(true)
    if (phoneError || displayName.trim().length === 0) return

    let tokens = pendingTokens

    // If OTP hasn't been verified yet, attempt verification now (no auto-verify on 6th digit)
    if (!otpVerified) {
      if (!otpSent || !/^\d{6}$/.test(otp)) {
        alert("Please enter the 6-digit code to continue.")
        return
      }
      setLoading("verify")
      const res = await verifyOtp(phone, otp)
      setLoading(null)
      if (!(res.ok && res.data?.accessToken)) {
        alert("Invalid OTP")
        return
      }
      tokens = { accessToken: res.data.accessToken, refreshToken: res.data.refreshToken as any }
      setPendingTokens(tokens)
      setOtpVerified(true)
    }

    // Persist tokens now (and only now) to prevent auto-redirects earlier
    if (tokens?.accessToken) {
      setAuthToken(tokens.accessToken)
      setLoginTokens(tokens.accessToken, tokens.refreshToken)
    }

    // Fetch profile after token is set
    try {
      // Create the user if needed
      const prof = await OolshikApi.complete(displayName.trim(), authEmail?.trim() || "")
      if (prof?.ok && prof.data) {
        // Profile complete success
        const prof = await OolshikApi.me()
        if (prof?.ok && prof.data) {
          const profile = prof.data as { id?: string | number; displayName?: string }
          setUserName(profile.displayName ?? (displayName || "You"))
          if (profile.id != null) setUserId(String(profile.id))
        } else {
          setUserName(displayName || "You")
        }
      }
    } catch {
      setUserName(displayName || "You")
    }

    // // Navigate to HomeFeed only from here
    // try {
    //   ;(navigation as any)?.navigate?.("HomeFeed")
    // } catch {}
  }

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($container)}
    >
      {/* Title */}
      <Text preset="heading" text="Log in" style={themed($title)} />

      {/* STEP 1: Phone */}
      <View style={themed($card)}>
        <View style={themed($cardHeader)}>
          <View style={themed($stepBadge)}>
            <Text text="1" weight="bold" style={{ color: "white" }} />
          </View>
          <Text text="Verify your mobile" weight="bold" />
          {otpVerified ? <Text text="✓" style={{ marginLeft: "auto", color: "#16A34A" }} /> : null}
        </View>

        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <View style={themed($ccBadge)}>
            <Text text="+91" weight="bold" style={{ color: colors.palette.neutral800 }} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              value={phone}
              onChangeText={(v) => setPhone(v.replace(/\D/g, "").slice(0, 10))}
              containerStyle={{ marginBottom: 0 }}
              keyboardType="phone-pad"
              placeholder="10-digit mobile"
              status={phoneError ? "error" : undefined}
              maxLength={10}
              editable={!otpVerified}
              inputWrapperStyle={themed($inputWrapperDense)}
              style={{ height: 50, paddingVertical: 0 }}
            />
          </View>
        </View>
        {!!phoneError && (
          <Text text={phoneError} size="xs" style={{ color: "#DC2626", marginTop: spacing.xs }} />
        )}

        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm }}>
          <Button
            text={
              otpSent
                ? resendIn > 0
                  ? `Resend in ${resendIn}s`
                  : loading === "send"
                    ? "Sending…"
                    : "Resend OTP"
                : loading === "send"
                  ? "Sending…"
                  : "Send OTP"
            }
            onPress={onSendOtp}
            disabled={!!phoneError || loading === "send" || (otpSent && resendIn > 0)}
            style={{ flex: 1, paddingVertical: spacing.xs }}
          />
        </View>
      </View>

      {/* STEP 2: OTP */}
      <View style={themed($card)}>
        <View style={themed($cardHeader)}>
          <View style={themed($stepBadge)}>
            <Text text="2" weight="bold" style={{ color: "white" }} />
          </View>
          <Text text="Enter 6-digit code" weight="bold" />
          {otpVerified ? (
            <Text text="✓ Verified" style={{ marginLeft: "auto", color: "#16A34A" }} />
          ) : null}
        </View>

        <OtpBoxes
          value={otp}
          onChange={async (value) => {
            setOtp(value)
            if (value.length === 6 && otpSent && !otpVerified && loading !== "verify") {
              await onVerifyOtp(value)
            }
          }}
          editable={otpSent && !otpVerified}
        />

        {!otpVerified && (
          <View style={{ marginTop: spacing.sm }}>
            <Button
              text={loading === "verify" ? "Verifying…" : "Verify"}
              onPress={() => onVerifyOtp()}
              disabled={!otpSent || otp.length !== 6 || loading === "verify"}
              style={{ marginTop: spacing.md, paddingVertical: spacing.xs }}
            />
          </View>
        )}
      </View>

      {/* STEP 3: Name */}
      <View style={themed($card)}>
        <View style={themed($cardHeader)}>
          <View style={themed($stepBadge)}>
            <Text text="3" weight="bold" style={{ color: "white" }} />
          </View>
          <Text text="Your name" weight="bold" />
          {displayName.trim().length > 0 ? (
            <Text text="✓" style={{ marginLeft: "auto", color: "#16A34A" }} />
          ) : null}
        </View>
        <TextField
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          autoCapitalize="words"
          status={triedContinue && nameError ? "error" : undefined}
          helper={triedContinue && nameError ? nameError : undefined}
        />
      </View>

      <View style={themed($card)}>
        <Pressable onPress={() => setShowEmail((v) => !v)} style={themed($cardHeader)}>
          <Text text="Email" weight="bold" />
          <Text text={showEmail ? "-" : "+"} style={{ marginLeft: "auto", fontWeight: "bold" }} />
        </Pressable>
        {showEmail && (
          <TextField
            value={authEmail}
            onChangeText={setAuthEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="name@example.com"
            helper={validationError}
            status={validationError ? "error" : undefined}
          />
        )}
      </View>

      {/* Bottom fixed Continue */}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md }}
      >
        <Button
          text="Continue"
          onPress={onContinue}
          disabled={!!phoneError || displayName.trim().length === 0}
          style={{ paddingVertical: spacing.sm }}
        />
      </View>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  // Do not set flex here; it can prevent ScrollView from scrolling
  padding: spacing.md,
  paddingBottom: 96,
})

const $title: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

const $card: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.palette.neutral100,
  borderColor: colors.palette.neutral300,
  borderWidth: 1,
  borderRadius: spacing.md,
  padding: spacing.md,
  marginBottom: spacing.md,
})

const $cardHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
  marginBottom: spacing.md,
})

const $stepBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 28,
  height: 28,
  borderRadius: 14,
  backgroundColor: colors.palette.primary500,
  alignItems: "center",
  justifyContent: "center",
})

const $ccBadge: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  paddingHorizontal: spacing.sm,
  height: 50,
  borderRadius: spacing.sm,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.palette.neutral100,
})

const $inputWrapperDense: ThemedStyle<ViewStyle> = () => ({
  height: 50,
  minHeight: 50,
  alignItems: "center",
  paddingVertical: 0,
})

// @demo remove-file
