// app/api/client.ts
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios"
import { Platform } from "react-native"
import { create, ApisauceInstance } from "apisauce"
import { tokens } from "@/auth/tokens"
import { authEvents } from "@/auth/events"
import Config from "@/config"

// ---------- Toggleable API logs (default: true) ----------
export let API_LOGS_ENABLED = true
export function setApiLogsEnabled(enabled: boolean) {
  API_LOGS_ENABLED = !!enabled
}

// augment config to carry timing metadata (no type import needed; keep it loose)
type ReqMeta = { _tsStart?: number }

function maskHeaders(h: any) {
  const clone = { ...(h || {}) }
  if (clone.Authorization) clone.Authorization = "Bearer ****"
  if (clone.authorization) clone.authorization = "Bearer ****"
  return clone
}

function isAuthPath(url?: string | null) {
  if (!url) return false
  return AUTH_WHITELIST.some((p) => url.includes(p))
}

function redactBody(url?: string | null, data?: any) {
  // Do not log OTP codes or passwords for auth endpoints
  if (isAuthPath(url)) return "[REDACTED_FOR_AUTH_ENDPOINT]"
  return data
}

function logRequest(prefix: string, cfg: any) {
  if (!API_LOGS_ENABLED) return
  try {
    const method = (cfg?.method || "GET").toUpperCase()
    const url = cfg?.baseURL ? `${cfg.baseURL}${cfg.url || ""}` : cfg?.url
    const params = cfg?.params
    const data = redactBody(cfg?.url, cfg?.data)
    const headers = maskHeaders(cfg?.headers)
    console.log(`⬆️  ${prefix} REQUEST: ${method} ${url}`, { params, data, headers })
  } catch {}
}

function logResponse(prefix: string, cfg: any, resp: any) {
  if (!API_LOGS_ENABLED) return
  try {
    const method = (cfg?.method || "GET").toUpperCase()
    const url = cfg?.baseURL ? `${cfg.baseURL}${cfg.url || ""}` : cfg?.url
    const status = resp?.status
    const dur =
      typeof (cfg as ReqMeta)?._tsStart === "number"
        ? Date.now() - (cfg as ReqMeta)._tsStart!
        : undefined
    const headers = maskHeaders(resp?.headers)
    const data = resp?.data
    const extra = dur != null ? ` (${dur}ms)` : ""
    console.log(`⬇️  ${prefix} RESPONSE: ${status} ${method} ${url}${extra}`, { data, headers })
  } catch {}
}

function logError(prefix: string, cfg: any, err: any) {
  if (!API_LOGS_ENABLED) return
  try {
    const method = (cfg?.method || "GET").toUpperCase()
    const url = cfg?.baseURL ? `${cfg.baseURL}${cfg.url || ""}` : cfg?.url
    const status = err?.response?.status
    const dur =
      typeof (cfg as ReqMeta)?._tsStart === "number"
        ? Date.now() - (cfg as ReqMeta)._tsStart!
        : undefined
    const headers = maskHeaders(err?.response?.headers)
    const data = err?.response?.data
    const extra = dur != null ? ` (${dur}ms)` : ""
    console.log(`❌ ${prefix} ERROR: ${status ?? "NO_STATUS"} ${method} ${url}${extra}`, {
      response: { data, headers },
      message: err?.message,
    })
  } catch {}
}

const devHost = Platform.select({ ios: "http://localhost:8080", android: "http://10.0.2.2:8080" })
const rawHost = (Config.API_URL && Config.API_URL.trim().length > 0 ? Config.API_URL : devHost)!
  .trim()
  .replace(/\/+$/, "")
const BASE_URL = /\/api$/i.test(rawHost) ? rawHost : `${rawHost}/api`

// ---------- Axios instance (shared) ----------
export const axiosInstance: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}`,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
})

// ---------- Single-flight refresh queue ----------
let isRefreshing = false
type Subscriber = (newAccess: string | null) => void
const subscribers: Subscriber[] = []
function subscribeTokenRefresh(cb: Subscriber) {
  subscribers.push(cb)
}
function flushSubscribers(newAccess: string | null) {
  while (subscribers.length) {
    const cb = subscribers.shift()
    try {
      cb?.(newAccess)
    } catch {}
  }
}

// Paths that should NOT attach Authorization or trigger refresh
const AUTH_WHITELIST = ["/auth/otp/request", "/auth/otp/verify", "/auth/refresh"]

// ---------- Attach access token ----------
axiosInstance.interceptors.request.use((config) => {
  ;(config as any as ReqMeta)._tsStart = Date.now()
  logRequest("AXIOS", config)
  const isAuthEndpoint = !!config.url && AUTH_WHITELIST.some((p) => config.url!.includes(p))
  const access = tokens.access
  if (!isAuthEndpoint && access) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${access}`
  }
  return config
})

// A raw axios (no interceptors) for refresh call
const raw = axios.create({
  baseURL: `${BASE_URL}`,
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
})
// ---- logging for raw axios (refresh) ----
raw.interceptors.request.use((config) => {
  ;(config as any as ReqMeta)._tsStart = Date.now()
  logRequest("RAW", config)
  return config
})
raw.interceptors.response.use(
  (res) => {
    try {
      logResponse("RAW", (res?.config as any) ?? {}, res)
    } catch {}
    return res
  },
  (err) => {
    try {
      logError("RAW", (err?.config as any) ?? {}, err)
    } catch {}
    return Promise.reject(err)
  },
)

async function refreshAccessToken(): Promise<string> {
  const refresh = tokens.refresh
  if (!refresh) throw new Error("NO_REFRESH_TOKEN")

  const resp = await raw.post("/auth/refresh", { refreshToken: refresh })
  const body: any = resp?.data ?? {}

  // Support multiple shapes from backend
  const newAccess = body.accessToken ?? body?.data?.accessToken ?? body?.token?.accessToken
  const newRefresh =
    body.refreshToken ?? body?.data?.refreshToken ?? body?.token?.refreshToken ?? refresh

  if (!newAccess) throw new Error("NO_ACCESS_FROM_REFRESH")

  tokens.setBoth(newAccess, newRefresh)
  return newAccess
}

// ---------- 401/419 handling + retry ----------
axiosInstance.interceptors.response.use(
  (res) => {
    try {
      logResponse("AXIOS", (res?.config as any) ?? {}, res)
    } catch {}
    return res
  },
  async (error: AxiosError) => {
    try {
      logError("AXIOS", (error?.config as any) ?? {}, error)
    } catch {}

    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined
    const status = error.response?.status ?? 0
    const url = original?.url || ""

    const isAuthEndpoint = AUTH_WHITELIST.some((p) => url.includes(p))
    const shouldTryRefresh = (status === 401 || status === 419) && !isAuthEndpoint

    if (!shouldTryRefresh) {
      // If refresh endpoint itself fails or forbidden → logout hard
      if (isAuthEndpoint && (status === 401 || status === 403)) {
        tokens.clear()
        authEvents.emit("logout")
      }
      return Promise.reject(error)
    }

    // avoid infinite loop
    if (original?._retry) {
      tokens.clear()
      authEvents.emit("logout")
      return Promise.reject(error)
    }

    // Already refreshing? queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newAccess) => {
          if (!newAccess) return reject(error)
          try {
            const cfg: AxiosRequestConfig = {
              ...original,
              headers: { ...(original?.headers || {}), Authorization: `Bearer ${newAccess}` },
              _retry: true,
            } as any
            resolve(axiosInstance.request(cfg))
          } catch (e) {
            reject(e)
          }
        })
      })
    }

    // Start a refresh
    original!._retry = true
    isRefreshing = true
    try {
      const newAccess = await refreshAccessToken()
      isRefreshing = false
      flushSubscribers(newAccess)

      const cfg: AxiosRequestConfig = {
        ...original,
        headers: { ...(original?.headers || {}), Authorization: `Bearer ${newAccess}` },
      }
      return axiosInstance.request(cfg)
    } catch (e) {
      isRefreshing = false
      flushSubscribers(null) // fail all queued
      tokens.clear()
      authEvents.emit("logout")
      return Promise.reject(e)
    }
  },
)

// ---------- Apisauce wrapper (your app should use this) ----------
export const api: ApisauceInstance = create({
  baseURL: `${BASE_URL}/api`,
  timeout: 10000,
  axiosInstance, // 👈 use our configured axios with interceptors
})
export type ServerTask = {
  id: string
  title?: string
  description?: string
  status: "PENDING" | "ASSIGNED" | "COMPLETED" | "OPEN" | "CANCELLED" | "CANCELED"
  voiceUrl?: string | null
  latitude: number
  longitude: number
  radiusMeters: number
  requesterId?: string
  helperId?: string | null
  createdAt?: string
  updatedAt?: string
  requesterName?: string
  requesterPhoneNumber?: string
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
  radiusMeters: number
  createdById?: string
  createdByName?: string
  createdAt?: string
  title: string
  latitude: number
  longitude: number
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

  revealPhone: (id: string) => api.post(`/requests/${id}/revealPhone`, {}),
  // Expect { phoneNumber: string revealCount: number }
}
// Optional helper: call this after successful OTP verify to persist tokens
export function setLoginTokens(accessToken?: string | null, refreshToken?: string | null) {
  tokens.setBoth(accessToken ?? null, refreshToken ?? null)
}

// Optional helper: global logout
export function logoutNow() {
  tokens.clear()
  authEvents.emit("logout")
}

// To toggle logs at runtime:
// import { setApiLogsEnabled } from "@/app/api/client"
// setApiLogsEnabled(false)
