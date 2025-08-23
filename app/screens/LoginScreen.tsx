import { FC, useEffect, useMemo, useRef, useState } from "react"
import { TextInput, TextStyle, View, ViewStyle, Pressable } from "react-native"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { OolshikApi } from "@/api"
import { setAccessTokenHeader, setTokens } from "@/api/client"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAuth } from "@/context/AuthContext"
import type { AppStackScreenProps } from "@/navigators/AppNavigator"
import type { ThemedStyle } from "@/theme/types"
import { useAppTheme } from "@/theme/context"

interface LoginScreenProps extends AppStackScreenProps<"Login"> {}

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

export const LoginScreen: FC<LoginScreenProps> = () => {
  // Mandatory phone & OTP
  const [phone, setPhone] = useState("") // 10 digits (India-style)
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [loading, setLoading] = useState<"send" | "verify" | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const [showEmail, setShowEmail] = useState(false)

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
    if (t.length === 0) return "can't be blank"
    if (t.length < 10) return "must be 10 digits"
    return ""
  }, [phone])

  // Real services
  async function sendOtp(p: string) {
    try {
      return await OolshikApi.requestOtp(p)
    } catch {
      return { ok: false } as any
    }
  }

  async function verifyOtp(p: string, code: string, dName?: string, email?: string) {
    try {
      return await OolshikApi.verifyOtp({ phone: p, code, displayName: dName, email })
    } catch {
      return { ok: false } as any
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
    if (res.ok) {
      setOtpSent(true)
      setOtp("")
      setOtpVerified(false)
      setResendIn(30)
    } else {
      alert("Failed to send OTP")
    }
  }

  const onVerifyOtp = async () => {
    if (!otpSent) return
    if (!/^\d{6}$/.test(otp)) return
    setLoading("verify")
    const res = await verifyOtp(phone, otp, displayName || undefined, authEmail || undefined)
    setLoading(null)
    if (res.ok && res.data?.accessToken) {
      // Persist both tokens & prime API client
      setAuthToken(res.data.accessToken)
      setTokens(res.data.accessToken, res.data.refreshToken) // <-- NEW
      setOtpVerified(true)
    } else {
      alert("Invalid OTP")
    }
  }

  // Auto-verify when 6 digits are entered
  useEffect(() => {
    if (otpSent && otp.length === 6 && !otpVerified && loading !== "verify") {
      onVerifyOtp()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, otpSent])

  const onContinue = async () => {
    if (phoneError || !otpVerified) return
    // Fetch profile after verification (token already set)
    try {
      const prof = await OolshikApi.me()
      if (prof?.ok && prof.data) {
        const profile = prof.data as { id?: string | number; displayName?: string }
        setUserName(profile.displayName ?? (displayName || "You"))
        if (profile.id != null) setUserId(String(profile.id))
      } else {
        setUserName(displayName || "You")
      }
    } catch {
      setUserName(displayName || "You")
    }
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

        <OtpBoxes value={otp} onChange={setOtp} editable={otpSent && !otpVerified} />

        {!otpVerified && (
          <View style={{ marginTop: spacing.sm }}>
            <Button
              text={loading === "verify" ? "Verifying…" : "Verify"}
              onPress={onVerifyOtp}
              disabled={!otpSent || otp.length !== 6 || loading === "verify"}
              style={{ marginTop: spacing.md, paddingVertical: spacing.xs }}
            />
          </View>
        )}
      </View>

      {/* Optional Email / Name */}
      <View style={themed($card)}>
        <Text text="Your name (optional)" weight="bold" />
        <TextField
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="e.g., Nitin"
          autoCapitalize="words"
        />
      </View>

      <View style={themed($card)}>
        <Pressable onPress={() => setShowEmail((v) => !v)} style={themed($cardHeader)}>
          <Text text="Email (optional)" weight="bold" />
          <Text text={showEmail ? "–" : "+"} style={{ marginLeft: "auto" }} />
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
        style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md }}
      >
        <Button
          text="Continue"
          onPress={onContinue}
          disabled={!!phoneError || !otpVerified}
          style={{ paddingVertical: spacing.sm }}
        />
      </View>
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
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
