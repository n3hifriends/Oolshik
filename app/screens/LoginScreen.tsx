import { FC, startTransition, useEffect, useMemo, useRef, useState } from "react"
import { Alert, Platform, Pressable, TextInput, TextStyle, View, ViewStyle } from "react-native"
import { useTranslation } from "react-i18next"
import * as Google from "expo-auth-session/providers/google"
import * as WebBrowser from "expo-web-browser"

import { Button } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { OolshikApi, type AuthMeResponse } from "@/api"
import { setLoginTokens } from "@/api/client"
import Config from "@/config"
import { useAuth } from "@/context/AuthContext"
import {
  getProfileExtras,
  updateProfileExtras,
} from "@/features/profile/storage/profileExtrasStore"
import { pickDeviceLocaleTag, resolvePreferredLocale } from "@/i18n/locale"
import type { AppStackScreenProps } from "@/navigators/AppNavigator"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"
import i18n from "i18next"

WebBrowser.maybeCompleteAuthSession()

interface LoginScreenProps extends AppStackScreenProps<"Login"> {}

type AuthMode = "google" | "phone"
type GoogleFlowState =
  | "idle"
  | "loading"
  | "success"
  | "user-cancelled"
  | "token-exchange-failed"
  | "backend-auth-failed"
  | "network-failure"

function toE164(raw: string) {
  let p = raw.trim().replace(/\s+/g, "")
  if (!p) return ""
  if (p.startsWith("0")) p = p.slice(1)
  if (!p.startsWith("+")) p = `+91${p}`
  return p
}

function isNetworkFailure(problem?: string | null) {
  return (
    problem === "NETWORK_ERROR" || problem === "CONNECTION_ERROR" || problem === "TIMEOUT_ERROR"
  )
}

function googleFlowMessageKey(state: GoogleFlowState) {
  switch (state) {
    case "success":
      return "googleSuccess"
    case "user-cancelled":
      return "googleCancelled"
    case "token-exchange-failed":
      return "googleTokenExchangeFailed"
    case "backend-auth-failed":
      return "googleBackendAuthFailed"
    case "network-failure":
      return "googleNetworkFailure"
    default:
      return null
  }
}

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
      style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.xs }}
    >
      {digits.map((digit, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            maxWidth: 56,
            height: 56,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor:
              digit || (editable && index === Math.min(value.length, length - 1))
                ? colors.palette.primary500
                : colors.palette.neutral400,
            backgroundColor: editable ? colors.palette.neutral100 : colors.palette.neutral200,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text text={digit} weight="bold" style={{ fontSize: 20 }} />
        </View>
      ))}

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, length))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        maxLength={length}
        keyboardAppearance={theme.isDark ? "dark" : "light"}
        style={{ position: "absolute", opacity: 0, height: 0, width: 0 }}
        editable={editable}
      />
    </Pressable>
  )
}

export const LoginScreen: FC<LoginScreenProps> = () => {
  const { t } = useTranslation()
  const { themed, theme } = useAppTheme()
  const { spacing, colors } = theme
  const isDark = theme.isDark

  const platformGoogleClientId =
    Platform.OS === "android"
      ? Config.GOOGLE_ANDROID_CLIENT_ID
      : Platform.OS === "ios"
        ? Config.GOOGLE_IOS_CLIENT_ID
        : Config.GOOGLE_WEB_CLIENT_ID

  const phoneOtpEnabled = Config.AUTH_PHONE_OTP_ENABLED
  const googlePhoneRequired = Config.AUTH_GOOGLE_REQUIRE_PHONE
  const googleEnabled = Config.AUTH_GOOGLE_ENABLED && Boolean(platformGoogleClientId)

  const [authMode, setAuthMode] = useState<AuthMode>(googleEnabled ? "google" : "phone")
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [triedContinue, setTriedContinue] = useState(false)
  const [loading, setLoading] = useState<"send" | "verify" | "google" | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const [showEmail, setShowEmail] = useState(false)
  const [pendingTokens, setPendingTokens] = useState<{
    accessToken: string
    refreshToken: string
  } | null>(null)
  const [googleFlowState, setGoogleFlowState] = useState<GoogleFlowState>("idle")
  const [googleServerMessage, setGoogleServerMessage] = useState<string | null>(null)

  const { setAuthEmail, authEmail, setAuthToken, setUserId, setUserName, validationError } =
    useAuth()

  const googleConfigured = googleEnabled
  const googleScopes = useMemo(() => ["openid", "profile", "email"], [])
  const googleRedirectUri = useMemo(
    () => (Platform.OS === "android" ? "com.oolshik.aan:/oauthredirect" : undefined),
    [],
  )
  const googleAuthConfig = useMemo(
    () => ({
      webClientId: Config.GOOGLE_WEB_CLIENT_ID || undefined,
      androidClientId: Config.GOOGLE_ANDROID_CLIENT_ID || undefined,
      iosClientId: Config.GOOGLE_IOS_CLIENT_ID || undefined,
      redirectUri: googleRedirectUri,
      scopes: googleScopes,
    }),
    [googleRedirectUri, googleScopes],
  )
  const googleRedirectOptions = useMemo(() => ({}), [])

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest(
    googleAuthConfig,
    googleRedirectOptions,
  )

  useEffect(() => {
    setAuthEmail("")
  }, [setAuthEmail])

  useEffect(() => {
    if (authMode === "phone" && !phoneOtpEnabled && googleEnabled) {
      setAuthMode("google")
    }
    if (authMode === "google" && !googleEnabled && phoneOtpEnabled) {
      setAuthMode("phone")
    }
  }, [authMode, googleEnabled, phoneOtpEnabled])

  useEffect(() => {
    let active = true
    ;(async () => {
      let localPreference: string | null = null
      try {
        const extras = await getProfileExtras()
        localPreference = extras.preferredLanguage ?? extras.language ?? null
      } catch {
        // best-effort
      }
      const resolved = resolvePreferredLocale({
        localPreference,
        deviceLocaleTag: pickDeviceLocaleTag() ?? null,
      })
      if (!active) return
      await i18n.changeLanguage(resolved)
      try {
        await updateProfileExtras({ preferredLanguage: resolved, language: resolved })
      } catch {
        // best-effort
      }
    })()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (resendIn <= 0) return
    const id = setInterval(() => setResendIn((seconds) => (seconds > 0 ? seconds - 1 : 0)), 1000)
    return () => clearInterval(id)
  }, [resendIn])

  useEffect(() => {
    if (!googleResponse) return
    const response = googleResponse as {
      type: string
      authentication?: { idToken?: string | null } | null
      params?: Record<string, string | undefined>
    }

    if (response.type === "cancel" || response.type === "dismiss") {
      setGoogleFlowState("user-cancelled")
      setLoading(null)
      return
    }
    if (response.type !== "success") {
      setGoogleFlowState("token-exchange-failed")
      setLoading(null)
      return
    }

    const idToken =
      response.authentication?.idToken ??
      (typeof response.params?.id_token === "string" ? response.params.id_token : undefined)

    if (!idToken) {
      setGoogleFlowState("token-exchange-failed")
      setLoading(null)
      return
    }

    startTransition(() => {
      void exchangeGoogleToken(idToken)
    })
  }, [googleResponse])

  const phoneError = useMemo(() => {
    const digits = phone.replace(/\D/g, "")
    if (digits.length === 0) return "phone_required"
    if (digits.length < 10) return "phone_digits"
    return ""
  }, [phone])
  const googlePhoneError = useMemo(() => {
    const digits = phone.replace(/\D/g, "")
    if (!googlePhoneRequired && digits.length === 0) return ""
    if (digits.length === 0) return ""
    return phoneError
  }, [googlePhoneRequired, phone, phoneError])

  const nameError = useMemo(() => {
    return displayName.trim().length === 0 ? "name_required" : ""
  }, [displayName])

  const optionalEmailError = useMemo(() => {
    if (!authEmail?.trim()) return ""
    return validationError
  }, [authEmail, validationError])

  const phoneShouldShowError = Boolean(phoneError) && (phone.length > 0 || otpSent || triedContinue)
  const activePhoneStep = otpVerified ? 3 : otpSent ? 2 : 1
  const phoneProgress = activePhoneStep / 3
  const emailExpanded = showEmail || Boolean(authEmail?.trim()) || Boolean(optionalEmailError)
  const canContinue =
    !phoneError &&
    displayName.trim().length > 0 &&
    !optionalEmailError &&
    (otpVerified || (otpSent && otp.length === 6))

  function handlePhoneChange(value: string) {
    const nextPhone = value.replace(/\D/g, "").slice(0, 10)
    if (nextPhone !== phone && otpSent) {
      setOtpSent(false)
      setOtp("")
      setOtpVerified(false)
      setPendingTokens(null)
      setResendIn(0)
    }
    setPhone(nextPhone)
  }

  async function hydrateProfile(fallbackDisplayName?: string) {
    try {
      const me = await OolshikApi.me()
      if (me?.ok && me.data) {
        const profile = me.data as AuthMeResponse
        setUserName(profile.displayName ?? fallbackDisplayName ?? "You")
        setAuthEmail(profile.email ?? "")
        if (profile.id != null) setUserId(String(profile.id))

        let localPreference: string | null = null
        try {
          const extras = await getProfileExtras()
          localPreference = extras.preferredLanguage ?? extras.language ?? null
        } catch {
          // best-effort
        }

        const preferredLanguage = resolvePreferredLocale({
          serverPreference:
            profile.preferredLanguage ?? profile.locale ?? profile.languages ?? null,
          localPreference,
          deviceLocaleTag: pickDeviceLocaleTag() ?? null,
        })
        await i18n.changeLanguage(preferredLanguage)
        await updateProfileExtras({
          preferredLanguage,
          language: preferredLanguage,
        })
        return
      }
    } catch {
      // best-effort fallback below
    }

    setUserName(fallbackDisplayName || "You")
    try {
      const extras = await getProfileExtras()
      const preferredLanguage = resolvePreferredLocale({
        localPreference: extras.preferredLanguage ?? extras.language ?? null,
        deviceLocaleTag: pickDeviceLocaleTag() ?? null,
      })
      await i18n.changeLanguage(preferredLanguage)
      await updateProfileExtras({
        preferredLanguage,
        language: preferredLanguage,
      })
    } catch {
      // best-effort
    }
  }

  async function finalizeBackendSession(
    session: { accessToken: string; refreshToken?: string | null },
    options?: { displayName?: string; email?: string; shouldCompleteProfile?: boolean },
  ) {
    setAuthToken(session.accessToken)
    setLoginTokens(session.accessToken, session.refreshToken)

    if (options?.shouldCompleteProfile) {
      await OolshikApi.complete(options.displayName?.trim() || "", options.email?.trim() || "")
    }

    await hydrateProfile(options?.displayName)
  }

  async function sendOtp() {
    setLoading("send")
    const response = await OolshikApi.requestOtp(toE164(phone))
    setLoading(null)
    if (response?.ok) {
      setOtpSent(true)
      setOtp("")
      setOtpVerified(false)
      setResendIn(30)
      return
    }
    Alert.alert(t("oolshik:login.otpSendFailed"))
  }

  async function verifyOtp(code?: string) {
    const entered = (code ?? otp).trim()
    if (!/^\d{6}$/.test(entered)) return null

    setLoading("verify")
    const response = await OolshikApi.verifyOtp({
      phone: toE164(phone),
      code: entered,
      displayName: displayName.trim() || undefined,
      email: authEmail?.trim() || undefined,
    })
    setLoading(null)

    if (response?.ok && response.data?.accessToken) {
      const session = {
        accessToken: response.data.accessToken,
        refreshToken: response.data.refreshToken,
      }
      setPendingTokens(session)
      setOtpVerified(true)
      return session
    }

    Alert.alert(
      t(
        isNetworkFailure(response?.problem)
          ? "oolshik:login.otpNetworkFailure"
          : "oolshik:login.invalidOtp",
      ),
    )
    return null
  }

  async function exchangeGoogleToken(idToken: string) {
    setLoading("google")
    const phoneHint =
      googlePhoneRequired && phone.replace(/\D/g, "").length === 10 ? toE164(phone) : undefined
    const response = await OolshikApi.googleSignIn({ idToken, phone: phoneHint })
    if (!(response?.ok && response.data?.accessToken)) {
      setLoading(null)
      const backendMessage =
        response?.data && typeof response.data === "object" && "message" in response.data
          ? response.data.message
          : null
      setGoogleServerMessage(typeof backendMessage === "string" ? backendMessage : null)
      setGoogleFlowState(
        isNetworkFailure(response?.problem) ? "network-failure" : "backend-auth-failed",
      )
      return
    }

    try {
      await finalizeBackendSession(response.data)
      setGoogleServerMessage(null)
      setGoogleFlowState("success")
    } catch {
      setGoogleFlowState("token-exchange-failed")
    } finally {
      setLoading(null)
    }
  }

  const onContinue = async () => {
    setTriedContinue(true)
    if (phoneError || displayName.trim().length === 0 || optionalEmailError) return

    let session = pendingTokens
    if (!otpVerified) {
      if (!otpSent || !/^\d{6}$/.test(otp)) {
        Alert.alert(t("oolshik:login.otpRequired"))
        return
      }
      session = await verifyOtp(otp)
      if (!session) return
    }
    if (!session) {
      Alert.alert(t("oolshik:login.invalidOtp"))
      return
    }

    try {
      await finalizeBackendSession(session, {
        displayName,
        email: authEmail,
        shouldCompleteProfile: true,
      })
    } catch {
      Alert.alert(t("oolshik:login.backendProfileSyncFailed"))
    }
  }

  const onGooglePress = async () => {
    if (!googleConfigured) {
      setGoogleServerMessage(null)
      setGoogleFlowState("backend-auth-failed")
      return
    }
    setGoogleServerMessage(null)
    setGoogleFlowState("idle")
    setLoading("google")
    try {
      const result = await promptGoogleAsync()
      if (result.type === "cancel" || result.type === "dismiss") {
        setLoading(null)
        setGoogleFlowState("user-cancelled")
      }
    } catch {
      setLoading(null)
      setGoogleFlowState("token-exchange-failed")
    }
  }

  const googleFlowMessage = googleFlowMessageKey(googleFlowState)
  const googleStatusMessage =
    googleServerMessage ?? (googleFlowMessage ? t(`oolshik:login.${googleFlowMessage}`) : null)

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($container)}
    >
      <View style={themed($heroCard)}>
        {/* <View style={themed($heroBadge)}>
          <Text
            text="O"
            weight="bold"
            style={{ color: isDark ? colors.palette.neutral100 : colors.palette.neutral900 }}
          />
        </View>

        <Text text="OOLSHIK" size="xxs" weight="semiBold" style={themed($eyebrow)} /> */}
        <Text preset="heading" text={t("oolshik:login.heading")} style={themed($title)} />
        <Text text={t("oolshik:login.subheading")} size="sm" style={themed($heroCopy)} />

        <View style={themed($heroHighlights)}>
          <View style={themed($heroPill)}>
            <Text text={t("oolshik:login.phoneTrust")} size="xxs" weight="medium" />
          </View>
          <View style={themed($heroPill)}>
            <Text text={t("oolshik:login.privacyTrust")} size="xxs" weight="medium" />
          </View>
          <View style={themed($heroPill)}>
            <Text text={t("oolshik:login.communityTrust")} size="xxs" weight="medium" />
          </View>
        </View>
      </View>

      {/* <Text text={t("oolshik:login.modeHelper")} size="xs" style={themed($modeHelper)} /> */}

      {googleEnabled && phoneOtpEnabled ? (
        <View style={themed($authModeRow)}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAuthMode("google")}
            style={[
              themed($authModeButton),
              authMode === "google" ? themed($authModeButtonActive) : undefined,
            ]}
          >
            <Text
              text={t("oolshik:login.continueWithGoogle")}
              weight="bold"
              style={authMode === "google" ? { color: colors.palette.neutral100 } : undefined}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => setAuthMode("phone")}
            style={[
              themed($authModeButton),
              authMode === "phone" ? themed($authModeButtonActive) : undefined,
            ]}
          >
            <Text
              text={t("oolshik:login.continueWithPhone")}
              weight="bold"
              style={authMode === "phone" ? { color: colors.palette.neutral100 } : undefined}
            />
          </Pressable>
        </View>
      ) : null}

      {!googleEnabled && !phoneOtpEnabled ? (
        <View style={themed($surfaceCard)}>
          <Text
            text={t("oolshik:login.authUnavailable")}
            size="sm"
            style={{ color: colors.palette.angry500 }}
          />
        </View>
      ) : authMode === "google" && googleEnabled ? (
        <View style={themed($surfaceCard)}>
          <View style={themed($surfaceHeader)}>
            <View style={themed($stepBadge)}>
              <Text
                text="G"
                weight="bold"
                style={{ color: isDark ? colors.palette.neutral100 : colors.palette.neutral900 }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text text={t("oolshik:login.googleHeading")} weight="bold" />
              <Text
                text={t("oolshik:login.googleHint")}
                size="xs"
                style={themed($supportingText)}
              />
            </View>
          </View>

          {googlePhoneRequired ? (
            <>
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                  alignItems: "center",
                  marginTop: spacing.md,
                }}
              >
                <View style={themed($ccBadge)}>
                  <Text text="+91" weight="bold" style={{ color: colors.palette.neutral800 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    value={phone}
                    onChangeText={handlePhoneChange}
                    containerStyle={{ marginBottom: 0 }}
                    keyboardType="phone-pad"
                    placeholder={t("oolshik:login.phonePlaceholder")}
                    status={googlePhoneError ? "error" : undefined}
                    maxLength={10}
                    inputWrapperStyle={themed($inputWrapperDense)}
                    style={{ height: 50, paddingVertical: 0 }}
                  />
                </View>
              </View>

              {!!googlePhoneError ? (
                <Text
                  text={
                    googlePhoneError === "phone_required"
                      ? t("oolshik:login.phoneRequired")
                      : t("oolshik:login.phoneDigits")
                  }
                  size="xs"
                  style={{ color: colors.palette.angry500, marginTop: spacing.xs }}
                />
              ) : null}
            </>
          ) : null}

          <View style={themed($benefitsList)}>
            <View style={themed($benefitRow)}>
              <View style={themed($benefitDot)} />
              <Text text={t("oolshik:login.googleBenefitFast")} size="xs" style={{ flex: 1 }} />
            </View>
            <View style={themed($benefitRow)}>
              <View style={themed($benefitDot)} />
              <Text text={t("oolshik:login.googleBenefitTrusted")} size="xs" style={{ flex: 1 }} />
            </View>
            <View style={themed($benefitRow)}>
              <View style={themed($benefitDot)} />
              <Text text={t("oolshik:login.googleBenefitProfile")} size="xs" style={{ flex: 1 }} />
            </View>
          </View>

          {!googleConfigured ? (
            <Text
              text={t("oolshik:login.googleUnavailable")}
              size="xs"
              style={{ color: colors.palette.angry500, marginTop: spacing.sm }}
            />
          ) : null}

          {googleStatusMessage ? (
            <Text
              text={googleStatusMessage}
              size="xs"
              style={{
                marginTop: spacing.sm,
                color:
                  googleFlowState === "success"
                    ? colors.palette.success500
                    : colors.palette.angry500,
              }}
            />
          ) : null}

          <Button
            text={
              loading === "google"
                ? t("oolshik:login.googleLoading")
                : t("oolshik:login.continueWithGoogle")
            }
            preset="filled"
            onPress={onGooglePress}
            disabled={
              !googleRequest || !googleConfigured || loading === "google" || !!googlePhoneError
            }
            style={{ marginTop: spacing.lg }}
          />
        </View>
      ) : phoneOtpEnabled ? (
        <>
          <View style={themed($surfaceCard)}>
            <View style={themed($progressHeader)}>
              <View style={{ flex: 1 }}>
                <Text
                  text={t("oolshik:login.stepCounter", { current: activePhoneStep, total: 3 })}
                  size="xs"
                  weight="semiBold"
                  style={themed($progressEyebrow)}
                />
                <Text
                  text={
                    activePhoneStep === 1
                      ? t("oolshik:login.stepVerifyMobile")
                      : activePhoneStep === 2
                        ? t("oolshik:login.stepEnterOtp")
                        : t("oolshik:login.stepYourName")
                  }
                  weight="bold"
                />
              </View>
              <View style={themed($progressPill)}>
                <Text
                  text={`${activePhoneStep}/3`}
                  size="xxs"
                  weight="bold"
                  style={{ color: colors.palette.neutral100 }}
                />
              </View>
            </View>

            <View style={themed($progressTrack)}>
              <View
                style={[themed($progressFill), { width: `${Math.max(phoneProgress * 100, 20)}%` }]}
              />
            </View>

            <Text text={t("oolshik:login.privacyNote")} size="xs" style={themed($supportingText)} />
          </View>

          <View style={themed([$stepCard, activePhoneStep === 1 && $stepCardActive])}>
            <View style={themed($cardHeader)}>
              <View style={themed($stepBadge)}>
                <Text
                  text="1"
                  weight="bold"
                  style={{ color: isDark ? colors.palette.neutral100 : colors.palette.neutral900 }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text text={t("oolshik:login.stepVerifyMobile")} weight="bold" />
                <Text
                  text={t("oolshik:login.phoneHint")}
                  size="xs"
                  style={themed($supportingText)}
                />
              </View>
              {otpVerified ? (
                <Text text="✓" style={{ marginLeft: "auto", color: colors.palette.success500 }} />
              ) : null}
            </View>

            <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
              <View style={themed($ccBadge)}>
                <Text text="+91" weight="bold" style={{ color: colors.palette.neutral800 }} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  value={phone}
                  onChangeText={handlePhoneChange}
                  containerStyle={{ marginBottom: 0 }}
                  keyboardType="phone-pad"
                  placeholder={t("oolshik:login.phonePlaceholder")}
                  status={phoneShouldShowError ? "error" : undefined}
                  maxLength={10}
                  editable={!otpVerified}
                  inputWrapperStyle={themed($inputWrapperDense)}
                  keyboardAppearance={isDark ? "dark" : "light"}
                  style={{ height: 50, paddingVertical: 0 }}
                />
              </View>
            </View>

            {phoneShouldShowError ? (
              <Text
                text={
                  phoneError === "phone_required"
                    ? t("oolshik:login.phoneRequired")
                    : t("oolshik:login.phoneDigits")
                }
                size="xs"
                style={{ color: colors.palette.angry500, marginTop: spacing.xs }}
              />
            ) : null}

            <Button
              text={
                otpSent
                  ? resendIn > 0
                    ? t("oolshik:login.resendIn", { seconds: resendIn })
                    : loading === "send"
                      ? t("oolshik:login.sending")
                      : t("oolshik:login.resendOtp")
                  : loading === "send"
                    ? t("oolshik:login.sending")
                    : t("oolshik:login.sendOtp")
              }
              preset="filled"
              onPress={sendOtp}
              disabled={!!phoneError || loading === "send" || (otpSent && resendIn > 0)}
              style={{ marginTop: spacing.md }}
            />
          </View>

          <View style={themed([$stepCard, activePhoneStep === 2 && $stepCardActive])}>
            <View style={themed($cardHeader)}>
              <View style={themed($stepBadge)}>
                <Text
                  text="2"
                  weight="bold"
                  style={{ color: isDark ? colors.palette.neutral100 : colors.palette.neutral900 }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text text={t("oolshik:login.stepEnterOtp")} weight="bold" />
                <Text text={t("oolshik:login.otpHint")} size="xs" style={themed($supportingText)} />
              </View>
              {otpVerified ? (
                <Text
                  text={`✓ ${t("oolshik:login.verified")}`}
                  style={{ marginLeft: "auto", color: colors.palette.success500 }}
                />
              ) : null}
            </View>

            <OtpBoxes
              value={otp}
              onChange={(value) => setOtp(value)}
              editable={otpSent && !otpVerified}
            />

            {!otpSent ? (
              <Text
                text={t("oolshik:login.sendOtpFirst")}
                size="xs"
                style={themed($supportingText)}
              />
            ) : null}

            {!otpVerified ? (
              <Button
                text={
                  loading === "verify" ? t("oolshik:login.verifying") : t("oolshik:login.verify")
                }
                preset="filled"
                onPress={() => {
                  void verifyOtp()
                }}
                disabled={!otpSent || otp.length !== 6 || loading === "verify"}
                style={{ marginTop: spacing.md }}
              />
            ) : null}
          </View>

          <View style={themed([$stepCard, activePhoneStep === 3 && $stepCardActive])}>
            <View style={themed($cardHeader)}>
              <View style={themed($stepBadge)}>
                <Text
                  text="3"
                  weight="bold"
                  style={{ color: isDark ? colors.palette.neutral100 : colors.palette.neutral900 }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text text={t("oolshik:login.stepYourName")} weight="bold" />
                <Text
                  text={t("oolshik:login.nameHint")}
                  size="xs"
                  style={themed($supportingText)}
                />
              </View>
              {displayName.trim().length > 0 ? (
                <Text text="✓" style={{ marginLeft: "auto", color: colors.palette.success500 }} />
              ) : null}
            </View>
            <TextField
              value={displayName}
              onChangeText={setDisplayName}
              placeholder={t("oolshik:login.stepYourName")}
              autoCapitalize="words"
              keyboardAppearance={isDark ? "dark" : "light"}
              status={triedContinue && nameError ? "error" : undefined}
              helper={triedContinue && nameError ? t("oolshik:login.nameRequired") : undefined}
            />
          </View>

          <View style={themed($stepCard)}>
            <Pressable onPress={() => setShowEmail((value) => !value)} style={themed($cardHeader)}>
              <View style={{ flex: 1 }}>
                <Text text={t("oolshik:login.email")} weight="bold" />
                <Text
                  text={t("oolshik:login.emailHint")}
                  size="xs"
                  style={themed($supportingText)}
                />
              </View>
              <Text text={emailExpanded ? "−" : "+"} style={themed($disclosure)} />
            </Pressable>
            {emailExpanded ? (
              <TextField
                value={authEmail}
                onChangeText={setAuthEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                keyboardAppearance={isDark ? "dark" : "light"}
                placeholder={t("oolshik:login.emailPlaceholder")}
                helper={optionalEmailError || undefined}
                status={optionalEmailError ? "error" : undefined}
              />
            ) : null}
          </View>

          <View style={themed($footerCard)}>
            <Text
              text={t("oolshik:login.readyToContinue")}
              size="xs"
              style={themed($supportingText)}
            />
            <Button
              text={t("oolshik:login.continue")}
              preset="filled"
              onPress={() => {
                void onContinue()
              }}
              disabled={!canContinue}
              style={{ marginTop: spacing.sm }}
            />
          </View>
        </>
      ) : null}
    </Screen>
  )
}

const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.md,
  paddingBottom: spacing.xl,
})

const $heroCard: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  backgroundColor: isDark ? colors.palette.primary100 : colors.palette.primary100,
  borderColor: isDark ? colors.palette.primary200 : colors.palette.primary200,
  borderWidth: 1,
  borderRadius: 28,
  padding: spacing.lg,
  marginBottom: spacing.md,
})

const $heroBadge: ThemedStyle<ViewStyle> = ({ colors, isDark }) => ({
  width: 40,
  height: 40,
  borderRadius: 20,
  backgroundColor: isDark ? colors.palette.primary500 : colors.palette.accent400,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 14,
})

const $eyebrow: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  letterSpacing: 1.2,
  marginBottom: 6,
})

const $title: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

const $heroCopy: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $heroHighlights: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
  marginTop: spacing.md,
})

const $heroPill: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  borderRadius: 999,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  backgroundColor: isDark ? colors.palette.neutral300 : colors.palette.neutral100,
})

const $modeHelper: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginBottom: spacing.xs,
})

const $surfaceCard: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  backgroundColor: isDark ? colors.palette.neutral200 : colors.palette.neutral100,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  borderRadius: 24,
  padding: spacing.lg,
  marginBottom: spacing.md,
})

const $surfaceHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: spacing.sm,
})

const $stepCard: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  backgroundColor: isDark ? colors.palette.neutral200 : colors.palette.neutral100,
  borderColor: colors.palette.neutral300,
  borderWidth: 1,
  borderRadius: 24,
  padding: spacing.md,
  marginBottom: spacing.md,
})

const $stepCardActive: ThemedStyle<ViewStyle> = ({ colors, isDark }) => ({
  borderColor: colors.palette.primary500,
  shadowColor: isDark ? colors.palette.neutral900 : colors.palette.overlay50,
  shadowOpacity: isDark ? 0.16 : 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 2,
})

const $cardHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: spacing.sm,
  marginBottom: spacing.md,
})

const $stepBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: colors.palette.primary500,
  alignItems: "center",
  justifyContent: "center",
})

const $supportingText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
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

const $progressHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $progressEyebrow: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.primary500,
  marginBottom: 4,
})

const $progressPill: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  minWidth: 46,
  borderRadius: 999,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.palette.primary500,
})

const $progressTrack: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  height: 8,
  borderRadius: 999,
  overflow: "hidden",
  backgroundColor: colors.palette.neutral300,
  marginTop: spacing.md,
  marginBottom: spacing.sm,
})

const $progressFill: ThemedStyle<ViewStyle> = ({ colors }) => ({
  height: "100%",
  borderRadius: 999,
  backgroundColor: colors.palette.primary500,
})

const $authModeRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  marginBottom: spacing.md,
})

const $authModeButton: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  flex: 1,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  borderRadius: 18,
  backgroundColor: isDark ? colors.palette.neutral200 : colors.palette.neutral100,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
  alignItems: "center",
  justifyContent: "center",
})

const $authModeButtonActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.primary500,
  borderColor: colors.palette.primary500,
})

const $benefitsList: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  marginTop: spacing.md,
})

const $benefitRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

const $benefitDot: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: colors.palette.primary500,
})

const $disclosure: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 20,
  lineHeight: 24,
  fontWeight: "700",
})

const $footerCard: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  backgroundColor: isDark ? colors.palette.neutral200 : colors.palette.neutral100,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  borderRadius: 24,
  padding: spacing.md,
  marginBottom: spacing.md,
})
