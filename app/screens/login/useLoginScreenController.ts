import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, Platform } from "react-native"
import { useTranslation } from "react-i18next"
import * as Google from "expo-auth-session/providers/google"

import { OolshikApi, type AuthMeResponse } from "@/api"
import { setLoginTokens } from "@/api/client"
import Config from "@/config"
import { useRemoteConfig } from "@/services/remoteConfig"
import { useAuth } from "@/context/AuthContext"
import {
  getProfileExtras,
  updateProfileExtras,
} from "@/features/profile/storage/profileExtrasStore"
import {
  fromLanguageCode,
  pickDeviceLocaleTag,
  resolvePreferredLocale,
  type SupportedLocaleTag,
  toLanguageCode,
} from "@/i18n/locale"
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

// Keep the redirect-uri options reference stable. The Expo Google auth hook
// memoizes against this object identity and can recreate the request when it changes.
const GOOGLE_REDIRECT_URI_OPTIONS = Object.freeze({})

export function useLoginScreenController() {
  const { t } = useTranslation()

  const platformGoogleClientId =
    Platform.OS === "android"
      ? Config.GOOGLE_ANDROID_CLIENT_ID
      : Platform.OS === "ios"
        ? Config.GOOGLE_IOS_CLIENT_ID
        : Config.GOOGLE_WEB_CLIENT_ID

  // Reactive: re-renders when Remote Config fetch completes (important for first-install users
  // who land here while fetch is still in flight).
  const rcFlags = useRemoteConfig()
  const phoneOtpEnabled = rcFlags.auth_phone_otp_enabled
  const googlePhoneRequired = rcFlags.auth_google_require_phone
  const googleEnabled = rcFlags.auth_google_enabled && Boolean(platformGoogleClientId)
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
  const googleAttemptSeqRef = useRef(0)
  const activeGoogleAttemptRef = useRef<number | null>(null)
  const lastHandledGoogleResponseRef = useRef<unknown>(null)
  const pendingGooglePhoneHintRef = useRef<string | undefined>(undefined)
  const phoneAlertShownRef = useRef(false)

  const { setAuthEmail, authEmail, setAuthToken, setUserId, setUserName, setUserPhone, validationError } =
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
    GOOGLE_REDIRECT_URI_OPTIONS,
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
    phoneAlertShownRef.current = false
  }, [authMode])

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

  const handlePhoneChange = useCallback((value: string) => {
    const nextPhone = value.replace(/\D/g, "").slice(0, 10)
    if (nextPhone === phone) return

    if (authMode === "google") {
      activeGoogleAttemptRef.current = null
      pendingGooglePhoneHintRef.current = undefined
      setGoogleServerMessage(null)
      setGoogleFlowState("idle")
      setLoading((current) => (current === "google" ? null : current))
    }

    if (otpSent) {
      setOtpSent(false)
      setOtp("")
      setOtpVerified(false)
      setPendingTokens(null)
      setResendIn(0)
    }

    setPhone(nextPhone)
  }, [authMode, otpSent, phone])

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

  const onUseMyPhoneNumberPress = useCallback(async () => {
    setPhoneHintLoading(true)
    const result = await getPhoneNumberHint()
    setPhoneHintLoading(false)

    if (result.status === "success") {
      handlePhoneChange(result.nationalPhoneNumber)
      return
    }

    showPhoneHintFeedback(result)
  }, [handlePhoneChange, t])

  const hydrateProfile = useCallback(async (fallbackDisplayName?: string) => {
    try {
      const me = await OolshikApi.me()
      if (me?.ok && me.data) {
        const profile = me.data as AuthMeResponse
        setUserName(profile.displayName ?? fallbackDisplayName ?? "You")
        setAuthEmail(profile.email ?? "")
        if (profile.id != null) setUserId(String(profile.id))
        setUserPhone(profile.phone ?? undefined)

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
  }, [setAuthEmail, setUserId, setUserName])

  const finalizeBackendSession = useCallback(async (
    session: { accessToken: string; refreshToken?: string | null },
    options?: { displayName?: string; email?: string; shouldCompleteProfile?: boolean },
  ) => {
    setAuthToken(session.accessToken)
    setLoginTokens(session.accessToken, session.refreshToken)

    if (options?.shouldCompleteProfile) {
      await OolshikApi.complete(options.displayName?.trim() || "", options.email?.trim() || "")
    }

    await hydrateProfile(options?.displayName)
  }, [hydrateProfile, setAuthToken])

  const sendOtp = useCallback(async () => {
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
  }, [phone, t])

  const verifyOtp = useCallback(async (code?: string) => {
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
  }, [authEmail, displayName, otp, phone, t])

  const exchangeGoogleToken = useCallback(async (
    idToken: string,
    phoneHint: string | undefined,
    attemptId: number,
  ) => {
    if (activeGoogleAttemptRef.current !== attemptId) return

    setLoading("google")
    const response = await OolshikApi.googleSignIn({ idToken, phone: phoneHint })
    if (activeGoogleAttemptRef.current !== attemptId) return

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
      activeGoogleAttemptRef.current = null
      return
    }

    try {
      await finalizeBackendSession(response.data)
      if (activeGoogleAttemptRef.current !== attemptId) return
      setGoogleServerMessage(null)
      setGoogleFlowState("success")
    } catch {
      if (activeGoogleAttemptRef.current !== attemptId) return
      setGoogleFlowState("token-exchange-failed")
    } finally {
      if (activeGoogleAttemptRef.current === attemptId) {
        activeGoogleAttemptRef.current = null
        setLoading(null)
      }
    }
  }, [finalizeBackendSession])

  useEffect(() => {
    if (!googleResponse) return
    if (lastHandledGoogleResponseRef.current === googleResponse) return
    lastHandledGoogleResponseRef.current = googleResponse
    const attemptId = activeGoogleAttemptRef.current
    if (attemptId == null) return

    const response = googleResponse as {
      type: string
      authentication?: { idToken?: string | null } | null
      params?: Record<string, string | undefined>
    }

    if (response.type === "cancel" || response.type === "dismiss") {
      activeGoogleAttemptRef.current = null
      setGoogleFlowState("user-cancelled")
      setLoading(null)
      return
    }
    if (response.type !== "success") {
      activeGoogleAttemptRef.current = null
      setGoogleFlowState("token-exchange-failed")
      setLoading(null)
      return
    }

    const idToken =
      response.authentication?.idToken ??
      (typeof response.params?.id_token === "string" ? response.params.id_token : undefined)

    if (!idToken) {
      activeGoogleAttemptRef.current = null
      setGoogleFlowState("token-exchange-failed")
      setLoading(null)
      return
    }

    const phoneHint = pendingGooglePhoneHintRef.current
    startTransition(() => {
      void exchangeGoogleToken(idToken, phoneHint, attemptId)
    })
  }, [exchangeGoogleToken, googleResponse])

  const onContinue = useCallback(async () => {
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
  }, [
    authEmail,
    displayName,
    optionalEmailError,
    otp,
    otpSent,
    otpVerified,
    pendingTokens,
    phoneError,
    t,
    finalizeBackendSession,
    verifyOtp,
  ])

  const onGooglePress = useCallback(async () => {
    if (!googleConfigured) {
      setGoogleServerMessage(null)
      setGoogleFlowState("backend-auth-failed")
      return
    }
    setGoogleServerMessage(null)
    setGoogleFlowState("idle")
    setGooglePhoneTouched(true)
    lastHandledGoogleResponseRef.current = null
    const attemptId = googleAttemptSeqRef.current + 1
    googleAttemptSeqRef.current = attemptId
    activeGoogleAttemptRef.current = attemptId
    pendingGooglePhoneHintRef.current =
      googlePhoneRequired && phone.replace(/\D/g, "").length === 10 ? toIndianE164(phone) : undefined
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
  }, [googleConfigured, googlePhoneRequired, phone, promptGoogleAsync])

  const handleContinuePress = useCallback(() => {
    void onContinue()
  }, [onContinue])

  const handleGooglePress = useCallback(() => {
    void onGooglePress()
  }, [onGooglePress])

  const handleUseMyPhoneNumberPress = useCallback(() => {
    void onUseMyPhoneNumberPress()
  }, [onUseMyPhoneNumberPress])

  const handleVerifyOtpPress = useCallback(() => {
    void verifyOtp()
  }, [verifyOtp])

  const handleSendOtpPress = useCallback(() => {
    void sendOtp()
  }, [sendOtp])

  const handleEmailToggle = useCallback(() => {
    setShowEmail((value) => !value)
  }, [])

  // Derived from i18n.language — stays in sync automatically because useTranslation()
  // above subscribes to language changes and triggers a re-render.
  const currentLanguage = fromLanguageCode(i18n.language)

  const handleLanguageChange = useCallback(async (tag: SupportedLocaleTag) => {
    const code = toLanguageCode(tag)
    await i18n.changeLanguage(code)
    try {
      await updateProfileExtras({ preferredLanguage: tag, language: code })
    } catch {
      // best-effort
    }
  }, [])

  const onLanguageChange = useCallback(
    (tag: SupportedLocaleTag) => {
      void handleLanguageChange(tag)
    },
    [handleLanguageChange],
  )

  const onPhoneFocus = useCallback(() => {
    if (phoneAlertShownRef.current) return
    phoneAlertShownRef.current = true
    Alert.alert(
      t("oolshik:login.phoneAlertTitle"),
      t("oolshik:login.phoneAlertBody"),
      [{ text: t("oolshik:login.phoneAlertDismiss") }],
    )
  }, [t])

  const handleGooglePhoneBlur = useCallback(() => {
    setGooglePhoneTouched(true)
  }, [])

  const googleFlowMessage = googleFlowMessageKey(googleFlowState)
  const googleStatusMessage =
    googleServerMessage ?? (googleFlowMessage ? t(`oolshik:login.${googleFlowMessage}`) : null)

  return {
    activePhoneStep,
    authEmail,
    authMode,
    currentLanguage,
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
    onContinue: handleContinuePress,
    onDisplayNameChange: setDisplayName,
    onEmailToggle: handleEmailToggle,
    onLanguageChange,
    onGooglePhoneBlur: handleGooglePhoneBlur,
    onGooglePress: handleGooglePress,
    onModeChange: setAuthMode,
    onOtpChange: setOtp,
    onPhoneChange: handlePhoneChange,
    onPhoneFocus,
    onSetAuthEmail: setAuthEmail,
    onUseMyPhoneNumberPress: handleUseMyPhoneNumberPress,
    onVerifyOtp: handleVerifyOtpPress,
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
    sendOtp: handleSendOtpPress,
    shouldShowGooglePhoneError,
    triedContinue,
  }
}
