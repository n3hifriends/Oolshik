import { setLoginTokens, type OnboardingPhase } from "@/api/client"
import { OolshikApi } from "@/api"
import { logEvent, AnalyticsEvent } from "@/services/analytics"
import { tokens } from "@/auth/tokens"
import { authEvents } from "@/auth/events"
import { navigationRef } from "@/navigators/navigationUtilities"
import {
  attachNotificationListeners,
  disablePushNotifications,
  getFcmTokenAsync,
  getCachedPushToken,
  registerDeviceTokenWithRetry,
  setCachedPushToken,
} from "@/utils/pushNotifications"
import { getProfileExtras } from "@/features/profile/storage/profileExtrasStore"
import { useTaskStore } from "@/store/taskStore"
import * as analyticsService from "@/services/analytics"
import * as crashReporting from "@/utils/crashReporting"
import { useRemoteConfig } from "@/services/remoteConfig"
import React, {
  createContext,
  useContext,
  useMemo,
  PropsWithChildren,
  useCallback,
  useEffect,
} from "react"
import { AppState } from "react-native"
import { useMMKVString } from "react-native-mmkv"

export type AuthContextType = {
  isAuthenticated: boolean
  authToken?: string
  authEmail?: string
  userId?: string
  userName?: string
  userPhone?: string
  onboardingPhase?: OnboardingPhase
  setAuthToken: (token?: string) => void
  setAuthEmail: (email?: string) => void
  setUserId: (id?: string) => void
  setUserName: (name?: string) => void
  setUserPhone: (phone?: string) => void
  setOnboardingPhase: (phase: OnboardingPhase) => void
  hydrateOnboardingPhase: (phase: OnboardingPhase) => void
  logout: () => void
  validationError: string
}
export const MMKV_AUTH_TOKEN = "auth.token"
export const MMKV_AUTH_EMAIL = "auth.email"
export const MMKV_USER_ID = "auth.userId"
export const MMKV_USER_NAME = "auth.userName"
export const MMKV_USER_PHONE = "auth.phone"
export const MMKV_ONBOARDING_PHASE = "auth.onboardingPhase"

export const AuthContext = createContext<AuthContextType | null>(null)

export interface AuthProviderProps {}

export function AuthProvider({ children }: PropsWithChildren<AuthProviderProps>) {
  const { feature_push_registration_enabled: pushEnabled } = useRemoteConfig()
  const [authToken, setAuthTokenMMKV] = useMMKVString(MMKV_AUTH_TOKEN)
  const [authEmail, setAuthEmailMMKV] = useMMKVString(MMKV_AUTH_EMAIL)
  const [userId, setUserIdMMKV] = useMMKVString(MMKV_USER_ID)
  const [userName, setUserNameMMKV] = useMMKVString(MMKV_USER_NAME)
  const [userPhone, setUserPhoneMMKV] = useMMKVString(MMKV_USER_PHONE)
  const [onboardingComplete, setOnboardingComplete] = useMMKVString("onboarding.v1.completed")
  const [onboardingPhaseRaw, setOnboardingPhaseMMKV] = useMMKVString(MMKV_ONBOARDING_PHASE)

  // Defaults for local/dev use
  const effectiveUserId = userId || "U-LOCAL-1"
  const effectiveUserName = userName || "You"

  const setAuthToken = useCallback(
    (token?: string) => {
      setAuthTokenMMKV(token ?? "")
      // ✅ keep HTTP client Authorization header in sync immediately
      // setLoginTokens(token || undefined) // (refresh stays as-is, managed by client after OTP/refresh)
    },
    [setAuthTokenMMKV],
  )

  const setAuthEmail = useCallback(
    (email?: string) => setAuthEmailMMKV(email ?? ""),
    [setAuthEmailMMKV],
  )

  const setUserId = useCallback((id?: string) => setUserIdMMKV(id ?? ""), [setUserIdMMKV])

  const setUserName = useCallback((name?: string) => setUserNameMMKV(name ?? ""), [setUserNameMMKV])

  const setUserPhone = useCallback((phone?: string) => setUserPhoneMMKV(phone ?? ""), [setUserPhoneMMKV])

  const setOnboardingPhase = useCallback(
    (phase: OnboardingPhase) => {
      setOnboardingPhaseMMKV(phase)
      if (phase === "FIRST_ACTION") logEvent(AnalyticsEvent.ONBOARDING_FIRST_ACTION)
      if (phase === "GRADUATED") logEvent(AnalyticsEvent.ONBOARDING_GRADUATED)
      OolshikApi.setOnboardingPhase(phase).catch(() => {
        crashReporting.breadcrumb(`auth:set_onboarding_phase_failed phase=${phase}`)
      })
    },
    [setOnboardingPhaseMMKV],
  )

  const hydrateOnboardingPhase = useCallback(
    (phase: OnboardingPhase) => {
      setOnboardingPhaseMMKV(phase)
    },
    [setOnboardingPhaseMMKV],
  )

  const logout = useCallback(() => {
    crashReporting.breadcrumb("auth:logout")
    crashReporting.clearUserId()
    crashReporting.setAuthContext({ authHasToken: false })
    // ✅ clear persisted state
    setAuthTokenMMKV("")
    setAuthEmailMMKV("")
    setUserIdMMKV("")
    setUserNameMMKV("")
    setUserPhoneMMKV("")
    // ✅ clear Authorization header in the HTTP client
    setLoginTokens(undefined, undefined)
    // ✅ clear nearby cache so the next user never sees this session's tasks
    useTaskStore.getState().clearMyTasks()
    useTaskStore.getState().clearNearby()
    // onboardingPhase is NOT cleared here — it is a permanent user-level state, not a
    // session credential. Clearing it caused a false "new user" flash on re-login while
    // the /me backfill was in-flight. The backfill (below) always runs on authToken
    // change and will correct the value if a different user logs in on this device.
    // (navigation back to Login is handled by your app's routing on isAuthenticated=false)
  }, [setAuthTokenMMKV, setAuthEmailMMKV, setUserIdMMKV, setUserNameMMKV, setUserPhoneMMKV])

  useEffect(() => {
    // Legacy-state recovery: older installs can retain `auth.token` while
    // transport storage lacks `auth.accessToken`, which makes the app appear
    // signed in but sends protected requests without Authorization.
    if (!authToken) return
    if (tokens.access) return
    setLoginTokens(authToken, tokens.refresh)
  }, [authToken])

  useEffect(() => {
    // Hydrate the nearby cache for the confirmed user. Uses raw userId (not effectiveUserId)
    // so the dev fallback "U-LOCAL-1" never loads a real user's scoped cache.
    // fetchActiveSummary is called here too so the "My Requests" badge count is available
    // immediately on login, before the user taps that tab.
    if (!authToken || !userId) return
    useTaskStore.getState().hydrateForUser(userId)
    useTaskStore.getState().fetchActiveSummary().catch(() => {})
  }, [authToken, userId])

  useEffect(() => {
    // Sync onboardingPhase from the server on every login. Running unconditionally
    // (not just when the local value is empty) ensures that if a different user logs
    // in on the same device they see their own phase rather than the previous user's
    // persisted value. It also eliminates the false "new user" flash that occurred
    // when logout cleared the phase and the async fetch hadn't completed yet.
    if (!authToken) return
    OolshikApi.me()
      .then((res) => {
        if (res.ok && res.data?.onboardingPhase) {
          setOnboardingPhaseMMKV(res.data.onboardingPhase)
          // Backfill the completion flag for sessions that predate this MMKV key
          // (users who installed before onboarding v1 was introduced). Without this,
          // the push-registration effect is permanently blocked for those users.
          if (res.data.onboardingPhase !== "FRESH" && !onboardingComplete) {
            setOnboardingComplete("true")
          }
        }
      })
      .catch(() => {})
  // authToken is the only trigger we need — run once per login, not on every phase change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authToken])

  useEffect(() => {
    const handler = () => {
      logout()
    }
    authEvents.on("logout", handler)
    return () => {
      authEvents.off("logout", handler)
    }
  }, [])

  useEffect(() => {
    if (!authToken) return
    const cleanup = attachNotificationListeners()

    if (!pushEnabled) {
      // Flag disabled — unregister token with backend (full unregister, not just local).
      // Re-runs whenever pushEnabled changes mid-session, e.g. after Remote Config activates.
      disablePushNotifications().catch(() => {})
      return cleanup
    }

    if (onboardingComplete !== "true") {
      // Permission will be requested explicitly at the end of onboarding.
      // Don't race the dialog with the navigation transition.
      return cleanup
    }

    let active = true
    ;(async () => {
      try {
        const extras = await getProfileExtras()
        const enabled = extras.notificationsEnabled ?? true
        if (!enabled) {
          await disablePushNotifications()
          return
        }
        const token = await getFcmTokenAsync()
        if (!active || !token) return
        await registerDeviceTokenWithRetry(token)
        setCachedPushToken(token)
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.log("FCM token registered")
        }
      } catch (err) {
        crashReporting.breadcrumb("push:registration_failed")
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn("push token registration failed", err)
        }
      }
    })()
    return () => {
      active = false
      cleanup()
    }
  }, [authToken, pushEnabled, onboardingComplete])

  // Re-register FCM token whenever the app returns to the foreground.
  // Firebase may silently rotate tokens (reinstall, service update, etc.); re-running on
  // foreground catches that without requiring a logout/login cycle.
  useEffect(() => {
    if (!authToken || !pushEnabled || onboardingComplete !== "true") return
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") return
      ;(async () => {
        try {
          const extras = await getProfileExtras()
          if (!(extras.notificationsEnabled ?? true)) return
          const token = await getFcmTokenAsync()
          if (!token) return
          if (token === getCachedPushToken()) return
          await registerDeviceTokenWithRetry(token)
          setCachedPushToken(token)
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.log("FCM token rotated and re-registered")
          }
        } catch (err) {
          if (__DEV__) {
            // eslint-disable-next-line no-console
            console.warn("push token foreground registration failed", err)
          }
          // best-effort
        }
      })()
    })
    return () => subscription.remove()
  }, [authToken, pushEnabled, onboardingComplete])

  // Sync real user identity to Analytics and Crashlytics on auth state change.
  // Uses raw `userId` + `authToken` — NOT effectiveUserId — to avoid attaching
  // the "U-LOCAL-1" dev fallback to production sessions.
  useEffect(() => {
    if (authToken && userId) {
      analyticsService.setUserId(userId)
      crashReporting.setUserId(userId)
      crashReporting.setAuthContext({ authHasToken: true, authStepLast: "session_hydrated" })
    } else {
      analyticsService.setUserId(null)
      crashReporting.clearUserId()
      crashReporting.setAuthContext({ authHasToken: false })
    }
  }, [authToken, userId])

  // 🔑 email validation logic preserved
  const validationError = useMemo(() => {
    if (!authEmail || authEmail.length === 0) return "Can't be blank"
    if (authEmail.length < 6) return "must be at least 6 characters"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) return "must be a valid email address"
    return ""
  }, [authEmail])

  const onboardingPhase = (onboardingPhaseRaw || undefined) as OnboardingPhase | undefined

  const value: AuthContextType = useMemo(
    () => ({
      isAuthenticated: !!authToken,
      authToken: authToken || undefined,
      authEmail: authEmail || undefined,
      userId: effectiveUserId,
      userName: effectiveUserName,
      userPhone: userPhone || undefined,
      onboardingPhase,
      setAuthToken,
      setAuthEmail,
      setUserId,
      setUserName,
      setUserPhone,
      setOnboardingPhase,
      hydrateOnboardingPhase,
      logout,
      validationError,
    }),
    [
      authToken,
      authEmail,
      effectiveUserId,
      effectiveUserName,
      userPhone,
      onboardingPhase,
      setAuthToken,
      setAuthEmail,
      setUserId,
      setUserName,
      setUserPhone,
      setOnboardingPhase,
      hydrateOnboardingPhase,
      logout,
      validationError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
