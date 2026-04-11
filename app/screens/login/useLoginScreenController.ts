import { startTransition, useEffect, useMemo, useState } from "react"
import { Alert, Platform } from "react-native"
import { useTranslation } from "react-i18next"
import * as Google from "expo-auth-session/providers/google"

import { OolshikApi, type AuthMeResponse } from "@/api"
import { setLoginTokens } from "@/api/client"
import Config from "@/config"
import { useAuth } from "@/context/AuthContext"
import {
  getProfileExtras,
  updateProfileExtras,
} from "@/features/profile/storage/profileExtrasStore"
import { pickDeviceLocaleTag, resolvePreferredLocale } from "@/i18n/locale"
import { getPhoneNumberHint, type PhoneNumberHintResult } from "@/services/phoneNumberHint"
import { toIndianE164 } from "@/utils/phoneNumber"
import i18n from "i18next"

type AuthMode = "google" | "phone"
type GoogleFlowState =
  | "idle"
  | "loading"
  | "success"
  | "user-cancelled"
  | "token-exchange-failed"
  | "backend-auth-failed"
  | "network-failure"

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

function alertWithBody(title: string, message: string) {
  Alert.alert(title, message)
}

export function useLoginScreenController() {
  const { t } = useTranslation()

  const platformGoogleClientId =
    Platform.OS === "android"
      ? Config.GOOGLE_ANDROID_CLIENT_ID
      : Platform.OS === "ios"
        ? Config.GOOGLE_IOS_CLIENT_ID
        : Config.GOOGLE_WEB_CLIENT_ID

  const phoneOtpEnabled = Config.AUTH_PHONE_OTP_ENABLED
  const googlePhoneRequired = Config.AUTH_GOOGLE_REQUIRE_PHONE
  const googleEnabled = Config.AUTH_GOOGLE_ENABLED && Boolean(platformGoogleClientId)
  const googleConfigured = googleEnabled
  const canUsePhoneNumberHint = Platform.OS === "android"

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
  const [googlePhoneTouched, setGooglePhoneTouched] = useState(false)
  const [phoneHintLoading, setPhoneHintLoading] = useState(false)

  const { setAuthEmail, authEmail, setAuthToken, setUserId, setUserName, validationError } =
    useAuth()

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

  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest(
    googleAuthConfig,
    {},
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
    return phoneError
  }, [googlePhoneRequired, phone, phoneError])

  const shouldShowGooglePhoneError = Boolean(googlePhoneError) && googlePhoneTouched
  const nameError = useMemo(() => (displayName.trim().length === 0 ? "name_required" : ""), [displayName])
  const optionalEmailError = useMemo(() => {
    if (!authEmail?.trim()) return ""
    return validationError
  }, [authEmail, validationError])

  const phoneShouldShowError = Boolean(phoneError) && (phone.length > 0 || otpSent || triedContinue)
  const activePhoneStep = (otpVerified ? 3 : otpSent ? 2 : 1) as 1 | 2 | 3
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

  function showPhoneHintFeedback(result: Exclude<PhoneNumberHintResult, { status: "success" }>) {
    const title = t("oolshik:login.phoneHintAlertTitle")

    if (result.status === "cancelled") {
      alertWithBody(title, t("oolshik:login.phoneHintCancelled"))
      return
    }

    if (result.status === "unsupported") {
      const text =
        result.reason === "play-services-unavailable"
          ? t("oolshik:login.phoneHintPlayServicesUnavailable")
          : result.reason === "hint-unavailable-on-device"
            ? t("oolshik:login.phoneHintUnavailableOnDevice")
            : t("oolshik:login.phoneHintUnavailable")
      alertWithBody(title, text)
      return
    }

    alertWithBody(
      title,
      result.code === "INVALID_PHONE_NUMBER"
        ? result.message || t("oolshik:login.phoneHintInvalidNumber")
        : t("oolshik:login.phoneHintFailed"),
    )
  }

  async function onUseMyPhoneNumberPress() {
    setPhoneHintLoading(true)
    const result = await getPhoneNumberHint()
    setPhoneHintLoading(false)

    if (result.status === "success") {
      handlePhoneChange(result.nationalPhoneNumber)
      return
    }

    showPhoneHintFeedback(result)
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
        await updateProfileExtras({ preferredLanguage, language: preferredLanguage })
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
      await updateProfileExtras({ preferredLanguage, language: preferredLanguage })
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
    const response = await OolshikApi.requestOtp(toIndianE164(phone))
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
      phone: toIndianE164(phone),
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
      googlePhoneRequired && phone.replace(/\D/g, "").length === 10 ? toIndianE164(phone) : undefined
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

  async function onContinue() {
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

  async function onGooglePress() {
    if (!googleConfigured) {
      setGoogleServerMessage(null)
      setGoogleFlowState("backend-auth-failed")
      return
    }
    setGoogleServerMessage(null)
    setGoogleFlowState("idle")
    setGooglePhoneTouched(true)
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

  return {
    activePhoneStep,
    authEmail,
    authMode,
    canContinue,
    canUsePhoneNumberHint,
    displayName,
    emailExpanded,
    googleConfigured,
    googleEnabled,
    googlePhoneError,
    googlePhoneRequired,
    googleRequestReady: Boolean(googleRequest),
    googleStatusMessage,
    googleStatusTone: googleFlowState === "success" ? ("success" as const) : ("error" as const),
    isGoogleLoading: loading === "google",
    isOtpSending: loading === "send",
    isOtpVerifying: loading === "verify",
    loading,
    nameError,
    onContinue: () => {
      void onContinue()
    },
    onDisplayNameChange: setDisplayName,
    onEmailToggle: () => setShowEmail((value) => !value),
    onGooglePhoneBlur: () => setGooglePhoneTouched(true),
    onGooglePress: () => {
      void onGooglePress()
    },
    onModeChange: setAuthMode,
    onOtpChange: setOtp,
    onPhoneChange: handlePhoneChange,
    onSetAuthEmail: setAuthEmail,
    onUseMyPhoneNumberPress: () => {
      void onUseMyPhoneNumberPress()
    },
    onVerifyOtp: () => {
      void verifyOtp()
    },
    optionalEmailError,
    otp,
    otpSent,
    otpVerified,
    phone,
    phoneError,
    phoneHintLoading,
    phoneOtpEnabled,
    phoneProgress,
    phoneShouldShowError,
    resendIn,
    sendOtp: () => {
      void sendOtp()
    },
    shouldShowGooglePhoneError,
    triedContinue,
  }
}
