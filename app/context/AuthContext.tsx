import { setLoginTokens } from "@/api/client"
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
  setAuthToken: (token?: string) => void
  setAuthEmail: (email?: string) => void
  setUserId: (id?: string) => void
  setUserName: (name?: string) => void
  setUserPhone: (phone?: string) => void
  logout: () => void
  validationError: string
}
export const MMKV_AUTH_TOKEN = "auth.token"
export const MMKV_AUTH_EMAIL = "auth.email"
export const MMKV_USER_ID = "auth.userId"
export const MMKV_USER_NAME = "auth.userName"
export const MMKV_USER_PHONE = "auth.phone"

export const AuthContext = createContext<AuthContextType | null>(null)

export interface AuthProviderProps {}

export function AuthProvider({ children }: PropsWithChildren<AuthProviderProps>) {
  const { feature_push_registration_enabled: pushEnabled } = useRemoteConfig()
  const [authToken, setAuthTokenMMKV] = useMMKVString(MMKV_AUTH_TOKEN)
  const [authEmail, setAuthEmailMMKV] = useMMKVString(MMKV_AUTH_EMAIL)
  const [userId, setUserIdMMKV] = useMMKVString(MMKV_USER_ID)
  const [userName, setUserNameMMKV] = useMMKVString(MMKV_USER_NAME)
  const [userPhone, setUserPhoneMMKV] = useMMKVString(MMKV_USER_PHONE)

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

  const logout = useCallback(() => {
    // ✅ clear persisted state
    setAuthTokenMMKV("")
    setAuthEmailMMKV("")
    setUserIdMMKV("")
    setUserNameMMKV("")
    setUserPhoneMMKV("")
    // ✅ clear Authorization header in the HTTP client
    setLoginTokens(undefined, undefined)
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
    let active = true
    const cleanup = attachNotificationListeners()

    if (!pushEnabled) {
      // Flag disabled — unregister token with backend (full unregister, not just local).
      // Re-runs whenever pushEnabled changes mid-session, e.g. after Remote Config activates.
      disablePushNotifications().catch(() => {})
      return cleanup
    }

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
      } catch {
        // best-effort
      }
    })()
    return () => {
      active = false
      cleanup()
    }
  }, [authToken, pushEnabled])

  // Re-register FCM token whenever the app returns to the foreground.
  // Firebase may silently rotate tokens (reinstall, service update, etc.); re-running on
  // foreground catches that without requiring a logout/login cycle.
  useEffect(() => {
    if (!authToken || !pushEnabled) return
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
        } catch {
          // best-effort
        }
      })()
    })
    return () => subscription.remove()
  }, [authToken, pushEnabled])

  // Sync real user identity to Analytics and Crashlytics on auth state change.
  // Uses raw `userId` + `authToken` — NOT effectiveUserId — to avoid attaching
  // the "U-LOCAL-1" dev fallback to production sessions.
  useEffect(() => {
    if (authToken && userId) {
      analyticsService.setUserId(userId)
      crashReporting.setUserId(userId)
    } else {
      analyticsService.setUserId(null)
      crashReporting.clearUserId()
    }
  }, [authToken, userId])

  // 🔑 email validation logic preserved
  const validationError = useMemo(() => {
    if (!authEmail || authEmail.length === 0) return "Can't be blank"
    if (authEmail.length < 6) return "must be at least 6 characters"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) return "must be a valid email address"
    return ""
  }, [authEmail])

  const value: AuthContextType = useMemo(
    () => ({
      isAuthenticated: !!authToken,
      authToken: authToken || undefined,
      authEmail: authEmail || undefined,
      userId: effectiveUserId,
      userName: effectiveUserName,
      userPhone: userPhone || undefined,
      setAuthToken,
      setAuthEmail,
      setUserId,
      setUserName,
      setUserPhone,
      logout,
      validationError,
    }),
    [
      authToken,
      authEmail,
      effectiveUserId,
      effectiveUserName,
      userPhone,
      setAuthToken,
      setAuthEmail,
      setUserId,
      setUserName,
      setUserPhone,
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
