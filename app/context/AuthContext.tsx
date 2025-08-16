import React, { createContext, useContext, useMemo, PropsWithChildren, useCallback } from "react"
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

export const AuthContext = createContext<AuthContextType | null>(null)

export interface AuthProviderProps {}

export function AuthProvider({ children }: PropsWithChildren<AuthProviderProps>) {
  const [authToken, setAuthTokenMMKV] = useMMKVString("auth.token")
  const [authEmail, setAuthEmailMMKV] = useMMKVString("auth.email")
  const [userId, setUserIdMMKV] = useMMKVString("auth.userId")
  const [userName, setUserNameMMKV] = useMMKVString("auth.userName")

  // Defaults for local/dev use
  const effectiveUserId = userId || "U-LOCAL-1"
  const effectiveUserName = userName || "You"

  const setAuthToken = useCallback(
    (token?: string) => setAuthTokenMMKV(token ?? ""),
    [setAuthTokenMMKV],
  )

  const setAuthEmail = useCallback(
    (email?: string) => setAuthEmailMMKV(email ?? ""),
    [setAuthEmailMMKV],
  )

  const setUserId = useCallback((id?: string) => setUserIdMMKV(id ?? ""), [setUserIdMMKV])

  const setUserName = useCallback((name?: string) => setUserNameMMKV(name ?? ""), [setUserNameMMKV])

  const logout = useCallback(() => {
    setAuthTokenMMKV("")
    setAuthEmailMMKV("")
    setUserIdMMKV("")
    setUserNameMMKV("")
  }, [setAuthTokenMMKV, setAuthEmailMMKV, setUserIdMMKV, setUserNameMMKV])

  // 🔑 email validation logic preserved
  const validationError = useMemo(() => {
    console.log("🚀 ~ AuthProvider ~ authEmail:", authEmail)
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
