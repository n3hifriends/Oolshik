import { setLoginTokens } from "@/api/client"
import { authEvents } from "@/auth/events"
import { navigationRef } from "@/navigators/navigationUtilities"
import React, {
  createContext,
  useContext,
  useMemo,
  PropsWithChildren,
  useCallback,
  useEffect, // ✅ added
} from "react"
import { useMMKVString } from "react-native-mmkv"

export type AuthContextType = {
  isAuthenticated: boolean
  authToken?: string
  authEmail?: string
  userId?: string
  userName?: string
  setAuthToken: (token?: string) => void
  setAuthEmail: (email?: string) => void
  setUserId: (id?: string) => void
  setUserName: (name?: string) => void
  logout: () => void
  validationError: string
}
export const MMKV_AUTH_TOKEN = "auth.token"
export const MMKV_AUTH_EMAIL = "auth.email"
export const MMKV_USER_ID = "auth.userId"
export const MMKV_USER_NAME = "auth.userName"

export const AuthContext = createContext<AuthContextType | null>(null)

export interface AuthProviderProps {}

export function AuthProvider({ children }: PropsWithChildren<AuthProviderProps>) {
  const [authToken, setAuthTokenMMKV] = useMMKVString(MMKV_AUTH_TOKEN)
  const [authEmail, setAuthEmailMMKV] = useMMKVString(MMKV_AUTH_EMAIL)
  const [userId, setUserIdMMKV] = useMMKVString(MMKV_USER_ID)
  const [userName, setUserNameMMKV] = useMMKVString(MMKV_USER_NAME)

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

  const logout = useCallback(() => {
    // ✅ clear persisted state
    setAuthTokenMMKV("")
    setAuthEmailMMKV("")
    setUserIdMMKV("")
    setUserNameMMKV("")
    // ✅ clear Authorization header in the HTTP client
    setLoginTokens(undefined, undefined)
    // (navigation back to Login is handled by your app's routing on isAuthenticated=false)
  }, [setAuthTokenMMKV, setAuthEmailMMKV, setUserIdMMKV, setUserNameMMKV])

  // ✅ on mount & whenever authToken changes (e.g., app relaunch), sync header once
  // useEffect(() => {
  //   setLoginTokens(authToken || undefined)
  // }, [authToken])

  useEffect(() => {
    const handler = () => {
      logout()
    }
    authEvents.on("logout", handler)
    return () => {
      authEvents.off("logout", handler)
    }
  }, [])

  // 🔑 email validation logic preserved
  const validationError = useMemo(() => {
    if (!authEmail || authEmail.length === 0) return "can't be blank"
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
      setAuthToken,
      setAuthEmail,
      setUserId,
      setUserName,
      logout,
      validationError,
    }),
    [
      authToken,
      authEmail,
      effectiveUserId,
      effectiveUserName,
      setAuthToken,
      setAuthEmail,
      setUserId,
      setUserName,
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
