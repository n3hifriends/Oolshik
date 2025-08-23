import { create } from "apisauce"
import { Platform } from "react-native"
import Config from "@/config"

// Choose a reachable host for simulator/emulator or use Config.API_URL if provided
// iOS Simulator can reach localhost directly; Android emulator must use 10.0.2.2
const devHost = Platform.select({ ios: "http://localhost:8080", android: "http://10.0.2.2:8080" })
// Prefer Config.API_URL when set (use your LAN IP on real devices); strip trailing slashes
// const baseHost = (
//   Config.API_URL && Config.API_URL.trim().length > 0 ? Config.API_URL : devHost
// )!.replace(/\/+$/, "")
const rawHost = (Config.API_URL && Config.API_URL.trim().length > 0 ? Config.API_URL : devHost)!
  .trim()
  .replace(/\/+$/, "")
const baseURL = /\/api$/i.test(rawHost) ? rawHost : `${rawHost}/api`

const api = create({
  baseURL: `${baseURL}`,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
})

// ---------- NEW: token helpers & interceptor ----------
let _accessToken: string | undefined
let _refreshToken: string | undefined
let _isRefreshing = false
let _queue: Array<() => void> = []

export const setTokens = (access?: string, refresh?: string) => {
  _accessToken = access
  _refreshToken = refresh
  if (access) api.setHeader("Authorization", `Bearer ${access}`)
  else api.deleteHeader("Authorization")
}

// Back-compat: still exported, delegates to setTokens (keeps existing imports working)
export const setAccessTokenHeader = (token?: string) => setTokens(token, _refreshToken)

// Install an axios-level response interceptor to refresh on 401 and retry once
const axiosInst: any = (api as any).axiosInstance
if (axiosInst?.interceptors?.response) {
  axiosInst.interceptors.response.use(
    (response: any) => response,
    async (error: any) => {
      const cfg = error?.config
      const status = error?.response?.status

      // Don’t attempt refresh for OTP/refresh endpoints or if no refresh token
      const url: string = cfg?.url || ""
      const isAuthCall = url.includes("/auth/otp") || url.includes("/auth/refresh")
      if (status !== 401 || isAuthCall || !_refreshToken) {
        return Promise.reject(error)
      }

      try {
        // Gate parallel refreshes
        if (_isRefreshing) {
          await new Promise<void>((resolve) => _queue.push(resolve))
        } else {
          _isRefreshing = true
          const res = await OolshikApi.refresh(_refreshToken)
          if (res.ok && res.data?.accessToken) {
            setTokens(res.data.accessToken, res.data.refreshToken ?? _refreshToken)
          } else {
            // refresh failed → clear and bubble up (caller can route to login)
            setTokens(undefined, undefined)
            notifyAuthLost()
          }
          _queue.forEach((fn) => fn())
          _queue = []
          _isRefreshing = false
        }

        // After refresh, retry the original request once (with new Authorization header)
        if (_accessToken && cfg) {
          cfg.headers = { ...(cfg.headers || {}), Authorization: `Bearer ${_accessToken}` }
          return axiosInst.request(cfg)
        }
        return Promise.reject(error)
      } catch (e) {
        _isRefreshing = false
        _queue = []
        return Promise.reject(e)
      }
    },
  )
}

export type ServerTask = {
  id: string
  title?: string
  description?: string
  status: "PENDING" | "ASSIGNED" | "COMPLETED" | "OPEN" | "CANCELLED" | "CANCELED"
  latitude: number
  longitude: number
  radiusMeters: number
  requesterId?: string
  helperId?: string | null
  createdAt?: string
  updatedAt?: string
}

export type Page<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  size: number
  number: number
  numberOfElements: number
  first: boolean
  last: boolean
  empty: boolean
  pageable?: any
  sort?: any
}

// Keep a Task type for app-facing code if needed later; for now it mirrors ServerTask
export type Task = ServerTask

type CreateTaskPayload = {
  voiceUrl: string
  description?: string
  lat: number
  lng: number
  radiusMeters: number
  createdById?: string
  createdByName?: string
  createdAt?: string
}

const toClientTask = (t: ServerTask): Task => ({ ...t })

export const OolshikApi = {
  // Create Request
  createTask: (payload: CreateTaskPayload) => api.post("/requests", payload),

  // Nearby
  async nearbyTasks(
    lat: number,
    lng: number,
    radiusMeters: number,
    statuses?: string[], // ✅ optional filter
    page = 0,
    size = 50,
  ) {
    const qs = new URLSearchParams()
    qs.set("lat", String(lat))
    qs.set("lng", String(lng))
    qs.set("radiusMeters", String(radiusMeters))
    qs.set("page", String(page))
    qs.set("size", String(size))
    if (statuses?.length) {
      statuses.forEach((s) => qs.append("statuses", s)) // repeat format: statuses=OPEN&statuses=ASSIGNED
    }

    const url = `/requests/nearby?${qs.toString()}`
    const res = await api.get<Page<ServerTask>>(url)
    if (res.ok) {
      const page = res.data
      if (page && Array.isArray(page.content)) {
        return { ok: res.ok, data: page.content }
      }
    } else {
      console.log("❌ nearbyTasks error:", res.problem, res.status)
    }
    return { ok: false }
  },

  // Accept
  acceptTask: (taskId: string) => api.post(`/requests/${taskId}/accept`, {}),

  // Complete
  completeTask: (taskId: string) => api.post(`/requests/${taskId}/complete`, {}),

  // Reviews
  addReview: (payload: { taskId: string; rating: number; comment?: string }) =>
    api.post("/reviews", payload),

  // Reports
  report: (payload: { targetUserId?: string; taskId?: string; reason: string; text?: string }) =>
    api.post("/reports", payload),

  // Device token (push)
  registerDevice: (token: string) => api.post("/users/device", { token }),

  // Media: pre-signed URL
  getPresigned: (contentType: string) =>
    api.post<{ uploadUrl: string; fileUrl: string }>("/media/pre-signed", { contentType }),

  // --- Auth / OTP ---
  requestOtp: (phone: string) => api.post("/auth/otp/request", { phone }),
  verifyOtp: (payload: { phone: string; code: string; displayName?: string; email?: string }) =>
    api.post<{ accessToken: string; refreshToken: string }>("/auth/otp/verify", payload),
  me: () => api.get("/auth/me"),

  // ---------- NEW: refresh endpoint ----------
  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string; refreshToken?: string }>("/auth/refresh", { refreshToken }),
  // ---------- /NEW ----------
}

// --- auth-lost event bridge so React code can logout ---
const authLostListeners = new Set<() => void>()
export const onAuthLost = (cb: () => void): (() => void) => {
  authLostListeners.add(cb)
  return () => {
    // ensure cleanup returns void, not boolean
    authLostListeners.delete(cb)
  }
}
const notifyAuthLost = () => {
  authLostListeners.forEach((fn) => {
    try {
      fn()
    } catch {}
  })
}
