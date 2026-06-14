// app/api/client.ts
import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios"
import { Platform } from "react-native"
import { create, ApisauceInstance } from "apisauce"
import { tokens } from "@/auth/tokens"
import { authEvents } from "@/auth/events"
import Config from "@/config"
import i18n from "i18next"
import { normalizeLocaleTag } from "@/i18n/locale"
import { ApiResult, normalizeApiError, requestWithRetry } from "@/api/apiResult"

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

function getContentType(headers?: any) {
  const contentType = headers?.["Content-Type"] ?? headers?.["content-type"]
  return typeof contentType === "string" ? contentType.toLowerCase() : ""
}

function isBinaryUpload(url?: string | null, headers?: any) {
  const contentType = getContentType(headers)
  if (contentType.includes("application/octet-stream")) return true
  return typeof url === "string" && /\/media\/audio\/[^/]+\/chunk\b/i.test(url)
}

function redactBody(url?: string | null, data?: any, headers?: any) {
  // Do not log OTP codes or passwords for auth endpoints
  if (isAuthPath(url)) return "[REDACTED_FOR_AUTH_ENDPOINT]"
  if (isBinaryUpload(url, headers)) return "[REDACTED_BINARY_UPLOAD]"
  if (typeof data === "string" && data.length > 2000)
    return `[REDACTED_LARGE_STRING length=${data.length}]`
  if (ArrayBuffer.isView(data)) return `[REDACTED_TYPED_ARRAY length=${data.byteLength}]`
  return data
}

function logRequest(prefix: string, cfg: any) {
  if (!API_LOGS_ENABLED) return
  try {
    const method = (cfg?.method || "GET").toUpperCase()
    const url = cfg?.baseURL ? `${cfg.baseURL}${cfg.url || ""}` : cfg?.url
    const params = cfg?.params
    const headers = maskHeaders(cfg?.headers)
    const data = redactBody(cfg?.url, cfg?.data, cfg?.headers)
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

function isErrorRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function isSpringSecurityForbidden(data: unknown) {
  if (!isErrorRecord(data)) return false
  return (
    data.error === "Forbidden" &&
    typeof data.path === "string" &&
    data.status === 403 &&
    typeof data.timestamp === "string"
  )
}

const devHost = Platform.select({ ios: "http://localhost:8080", android: "http://10.0.2.2:8080" })
const rawHost = (Config.API_URL && Config.API_URL.trim().length > 0 ? Config.API_URL : devHost)!
  .trim()
  .replace(/\/+$/, "")
const BASE_URL = /\/api$/i.test(rawHost) ? rawHost : `${rawHost}/api`
const REQUEST_TIMEOUT_MS = 10_000
const AUTH_REQUEST_TIMEOUT_MS = 30_000

const createHttpClientConfig = () => ({
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: { "Content-Type": "application/json" },
})

// ---------- Axios instance (shared) ----------
export const axiosInstance: AxiosInstance = axios.create(createHttpClientConfig())

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
const AUTH_WHITELIST = ["/auth/otp/request", "/auth/otp/verify", "/auth/google", "/auth/refresh"]

// ---------- Attach access token ----------
axiosInstance.interceptors.request.use((config) => {
  ;(config as any as ReqMeta)._tsStart = Date.now()
  logRequest("AXIOS", config)
  const isAuthEndpoint = !!config.url && AUTH_WHITELIST.some((p) => config.url!.includes(p))
  config.headers = config.headers ?? {}
  config.headers["Accept-Language"] = normalizeLocaleTag(i18n.language)
  const access = tokens.access
  if (!isAuthEndpoint && access) {
    config.headers.Authorization = `Bearer ${access}`
  }
  return config
})

// A raw axios (no interceptors) for refresh call
const raw = axios.create(createHttpClientConfig())
// ---- logging for raw axios (refresh) ----
raw.interceptors.request.use((config) => {
  ;(config as any as ReqMeta)._tsStart = Date.now()
  config.headers = config.headers ?? {}
  config.headers["Accept-Language"] = normalizeLocaleTag(i18n.language)
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
    const headers = (original?.headers || {}) as Record<string, unknown>
    const hadBearerHeader = Boolean(headers.Authorization || headers.authorization || tokens.access)

    const isAuthEndpoint = AUTH_WHITELIST.some((p) => url.includes(p))
    const shouldTryRefresh =
      !isAuthEndpoint &&
      (status === 401 ||
        status === 419 ||
        (status === 403 &&
          hadBearerHeader &&
          Boolean(tokens.refresh) &&
          isSpringSecurityForbidden(error.response?.data)))

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
  baseURL: BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  axiosInstance, // 👈 use our configured axios with interceptors
})
api.addAsyncRequestTransform(async (request) => {
  request.headers = request.headers ?? {}
  request.headers["Accept-Language"] = normalizeLocaleTag(i18n.language)
  if (tokens.access) {
    request.headers.Authorization = `Bearer ${tokens.access}`
  }
})
export type ServerTask = {
  id: string
  title?: string
  description?: string
  status:
    | "DRAFT"
    | "PENDING"
    | "PENDING_AUTH"
    | "ASSIGNED"
    | "WORK_DONE_PENDING_CONFIRMATION"
    | "REVIEW_REQUIRED"
    | "COMPLETED"
    | "OPEN"
    | "CANCELLED"
    | "CANCELED"
  voiceUrl?: string | null
  latitude: number
  longitude: number
  radiusMeters: number
  requesterId?: string
  helperId?: string | null
  pendingHelperId?: string | null
  createdAt?: string
  updatedAt?: string
  createdByName?: string
  createdByPhoneNumber?: string
  helperPhoneNumber?: string
  helperAcceptedAt?: string | null
  assignmentExpiresAt?: string | null
  pendingAuthExpiresAt?: string | null
  cancelledAt?: string | null
  cancelledBy?: string | null
  workDoneAt?: string | null
  completionConfirmationExpiresAt?: string | null
  completionMode?: "REQUESTER_CONFIRMED" | "AUTO_TIMEOUT" | string | null
  reassignedCount?: number | null
  releasedCount?: number | null
  requesterName?: string
  requesterPhoneNumber?: string
  ratingValue?: number | null
  ratingByRequester?: number | null
  ratingByHelper?: number | null
  requesterAvgRating?: number | null
  helperAvgRating?: number | null
  offerAmount?: number | null
  offerCurrency?: string | null
  offerUpdatedAt?: string | null
  canMarkDone?: boolean | null
  canConfirm?: boolean | null
  canReportIssue?: boolean | null
  canRate?: boolean | null
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

export type ReportPayload = {
  taskId?: string
  targetUserId?: string
  reason: "SPAM" | "INAPPROPRIATE" | "UNSAFE" | "OTHER"
  text?: string
}

export type FeedbackPayload = {
  feedbackType: "BUG" | "FEATURE" | "CSAT" | "SAFETY" | "OTHER"
  contextType: "APP" | "TASK" | "SCREEN"
  contextId?: string
  rating?: number
  tags?: string[]
  message?: string
  locale?: string
  appVersion?: string
  os?: string
  deviceModel?: string
}

export type FeedbackCreateResponse = {
  id: string
  createdAt?: string
}

export type UserStats = {
  avgRating?: number | null
  completedHelps?: number | null
}

export type AuthMeResponse = {
  id?: string | number
  phone?: string | null
  email?: string
  emailVerified?: boolean
  displayName?: string
  roles?: string
  languages?: string
  preferredLanguage?: string
  locale?: string
}

export type PaymentPayerRole = "REQUESTER" | "HELPER"
export type PaymentMode = "MERCHANT_QR" | "PAY_HELPER_DIRECT" | "PAY_REQUESTER_DIRECT"
export type PaymentProfileSourceType = "MANUAL" | "QR_EXTRACTED"

export type PaymentProfileApiResponse = {
  hasProfile: boolean
  id?: string
  maskedUpiId?: string | null
  payeeLabel?: string | null
  sourceType?: PaymentProfileSourceType | null
  isVerified?: boolean
  isActive?: boolean
  createdAt?: string | null
  updatedAt?: string | null
}

export type PaymentProfileEditApiResponse = PaymentProfileApiResponse & {
  upiId?: string | null
}

export type OfferUpdateApiResponse = {
  taskId: string
  offerAmount?: number | null
  offerCurrency?: string | null
  offerUpdatedAt?: string | null
  notificationSuppressed?: boolean
}

export type PaymentRequestApiResponse = {
  id: string
  taskId?: string
  status?: string
  paymentMode?: PaymentMode
  upiIntent?: string
  payerUserId?: string
  requesterUserId?: string
  helperUserId?: string
  paymentProfileUserId?: string
  payerRole?: PaymentPayerRole
  canPay?: boolean
  snapshot?: {
    taskId?: string
    payeeVpa?: string | null
    payeeMaskedVpa?: string | null
    payeeName?: string | null
    mcc?: string | null
    merchantId?: string | null
    txnRef?: string | null
    amountRequested?: number | null
    currency?: string | null
    note?: string | null
    createdAt?: string | null
    expiresAt?: string | null
    status?: string | null
  }
}

// Keep a Task type for app-facing code if needed later; for now it mirrors ServerTask
export type Task = ServerTask

export type ActiveRequestSummaryItem = {
  id: string
  status: ServerTask["status"] | string
  createdAt: string
}

export type ActiveRequestSummary = {
  cap: number
  activeCount: number
  blocked: boolean
  suggestedRequestId?: string | null
  activeRequests: ActiveRequestSummaryItem[]
}

export type UserNotification = {
  id: string
  title: string
  body: string
  read: boolean
  createdAt: string
}

export type UnreadCountResponse = {
  count: number
}

export type ActiveRequestCapReachedPayload = {
  code: "ACTIVE_REQUEST_CAP_REACHED"
  message: string
  cap: number
  activeCount: number
  activeRequestIds: string[]
  suggestedRequestId?: string | null
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return !!input && typeof input === "object" && !Array.isArray(input)
}

export function toActiveRequestCapPayload(input: unknown): ActiveRequestCapReachedPayload | null {
  if (!isRecord(input)) return null
  if (input.code !== "ACTIVE_REQUEST_CAP_REACHED") return null

  const cap = Number(input.cap)
  const activeCount = Number(input.activeCount)
  if (!Number.isFinite(cap) || cap < 1) return null
  if (!Number.isFinite(activeCount) || activeCount < 0) return null

  const activeRequestIds = Array.isArray(input.activeRequestIds)
    ? input.activeRequestIds.filter((id): id is string => typeof id === "string")
    : []
  if (activeRequestIds.length === 0) return null

  const message =
    typeof input.message === "string" ? input.message : "Active request limit reached."
  const suggestedRequestId =
    typeof input.suggestedRequestId === "string" ? input.suggestedRequestId : null

  return {
    code: "ACTIVE_REQUEST_CAP_REACHED",
    message,
    cap,
    activeCount,
    activeRequestIds,
    suggestedRequestId,
  }
}

type CreateTaskPayload = {
  voiceUrl?: string
  audioFileId?: string
  description?: string
  radiusMeters: number
  createdById?: string
  createdByName?: string
  createdAt?: string
  title: string
  latitude: number
  longitude: number
  offerAmount?: number | null
  offerCurrency?: string
}

function normalizeCreateTaskPayload(payload: CreateTaskPayload): CreateTaskPayload {
  const normalized: CreateTaskPayload = { ...payload }
  const audioFileId = normalized.audioFileId?.trim()
  const voiceUrl = normalized.voiceUrl?.trim()

  if (audioFileId) {
    normalized.audioFileId = audioFileId
    delete normalized.voiceUrl
    return normalized
  }

  delete normalized.audioFileId

  if (!voiceUrl) {
    delete normalized.voiceUrl
    return normalized
  }

  if (!isAbsoluteHttpsUrl(voiceUrl)) {
    throw new Error("Voice upload must use audioFileId or an absolute HTTPS voiceUrl.")
  }

  normalized.voiceUrl = voiceUrl
  return normalized
}

function isAbsoluteHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

const toClientTask = (t: ServerTask): Task => ({ ...t })

export const OolshikApi = {
  // Create Request
  createTask: async (payload: CreateTaskPayload) => {
    const response = await api.post("/requests", normalizeCreateTaskPayload(payload))
    return {
      ...response,
      activeCap: toActiveRequestCapPayload(response.data),
    }
  },

  getActiveSummary: () => api.get<ActiveRequestSummary>("/requests/active-summary"),

  // Nearby
  findTaskByTaskId: (taskId: string) => api.get(`/requests/${taskId}`),

  // Nearby
  async nearbyTasks(
    lat: number,
    lng: number,
    radiusMeters: number,
    statuses?: string[], // ✅ optional filter
    page = 0,
    size = 50,
  ): Promise<ApiResult<ServerTask[]>> {
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
    const res = await requestWithRetry(() => api.get<Page<ServerTask>>(url), {
      attempts: 3,
      baseDelayMs: 250,
      maxDelayMs: 1200,
    })
    if (res.ok) {
      const payload = res.data
      if (payload && Array.isArray(payload.content)) {
        return {
          ok: true,
          data: payload.content,
          meta: {
            requestId:
              typeof res.headers?.["x-correlation-id"] === "string"
                ? res.headers["x-correlation-id"]
                : undefined,
          },
        }
      }
      return {
        ok: false,
        error: {
          kind: "bad-data",
          temporary: false,
          message: "Nearby tasks response is missing page content.",
        },
      }
    } else {
      const error = normalizeApiError(res)
      console.log("❌ nearbyTasks error:", error.kind, error.status, error.requestId)
      return { ok: false, error }
    }
  },

  // Accept
  acceptTask: (taskId: string, payload: { latitude: number; longitude: number }) => {
    return api.post(`/requests/${taskId}/accept`, payload)
  },

  authorizeRequest: (taskId: string) => api.post(`/requests/${taskId}/authorize`, {}),

  rejectRequest: (taskId: string, payload: { reasonCode: string; reasonText?: string }) =>
    api.post(`/requests/${taskId}/reject`, payload),

  markRequestDone: (taskId: string) => api.post(`/requests/${taskId}/mark-done`, {}),

  confirmRequestCompletion: (taskId: string) =>
    api.post(`/requests/${taskId}/confirm-completion`, {}),

  reportRequestIssue: (taskId: string, payload: { reasonCode: string; reasonText?: string }) =>
    api.post(`/requests/${taskId}/report-issue`, payload),

  // Complete
  completeTask: (taskId: string) => api.post(`/requests/${taskId}/complete`, {}),

  rateTask: (taskId: string, payload: { rating: number; feedback?: string }) =>
    api.post(`/requests/${taskId}/rate`, payload),

  // Cancel / Release / Reassign
  cancelTask: (taskId: string, payload?: { reasonCode: string; reasonText?: string }) =>
    api.post(`/requests/${taskId}/cancel`, payload ?? {}),

  releaseTask: (taskId: string, payload?: { reasonCode?: string; reasonText?: string }) =>
    api.post(`/requests/${taskId}/release`, payload ?? {}),

  reassignTask: (taskId: string) => api.post(`/requests/${taskId}/reassign`, {}),

  updateTaskOffer: (
    taskId: string,
    payload: { offerAmount?: number | null; offerCurrency?: string },
  ) => api.patch<OfferUpdateApiResponse>(`/requests/${taskId}/offer`, payload),

  // Reviews
  addReview: (payload: { taskId: string; rating: number; comment?: string }) =>
    api.post("/reviews", payload),

  // Reports
  report: (payload: ReportPayload) => api.post("/reports", payload),

  // Feedback
  createFeedback: (payload: FeedbackPayload, idempotencyKey: string) =>
    api.post<FeedbackCreateResponse>("/feedback", payload, {
      headers: { "Idempotency-Key": idempotencyKey },
    }),

  // Device token (push)
  registerDevice: (token: string, platform?: string) =>
    api.post("/users/device", { token, platform }),
  unregisterDevice: (token: string) => api.delete("/users/device", {}, { data: { token } }),

  // Profile stats
  getMyStats: () => api.get<UserStats>("/users/me/stats"),

  // Helper location heartbeat
  updateHelperLocation: (latitude: number, longitude: number) =>
    api.post("/helpers/location", { latitude, longitude }),

  // Media: pre-signed URL
  getPresigned: (contentType: string) =>
    api.post<{ uploadUrl: string; fileUrl: string }>("/media/pre-signed", { contentType }),

  // --- Auth / OTP ---
  requestOtp: (phone: string) => api.post("/auth/otp/request", { phone }),
  verifyOtp: (payload: { phone: string; code: string; displayName?: string; email?: string }) =>
    api.post<{ accessToken: string; refreshToken: string }>("/auth/otp/verify", payload),
  googleSignIn: (payload: { idToken: string; phone?: string }) =>
    api.post<{ accessToken: string; refreshToken: string }>("/auth/google", payload, {
      timeout: AUTH_REQUEST_TIMEOUT_MS,
    }),
  complete: (displayName: string, email: string) =>
    api.post("/auth/complete", { displayName, email }),
  me: () => api.get<AuthMeResponse>("/auth/me"),
  updateMe: (patch: Record<string, unknown>) => api.put<AuthMeResponse>("/auth/me", patch),
  getPreferredLanguage: () => api.get<{ preferredLanguage?: string }>("/auth/me/language"),
  updatePreferredLanguage: (preferredLanguage: string) =>
    api.put<{ preferredLanguage?: string; message?: string }>("/auth/me/language", {
      preferredLanguage,
    }),

  // ---------- NEW: refresh endpoint ----------
  refresh: (refreshToken: string) =>
    api.post<{ accessToken: string; refreshToken?: string }>("/auth/refresh", { refreshToken }),
  // ---------- /NEW ----------

  revealPhone: (id: string) =>
    api.post<{ phoneNumber?: string; revealCount?: number; message?: string }>(
      `/requests/${id}/revealPhone`,
      {},
    ),
  // Expect { phoneNumber: string revealCount: number }

  // Payment APIs (if any) can go here
  createPaymentRequest: (body: {
    taskId: string
    rawPayload: string
    format: string
    payeeVpa?: string
    payeeName?: string
    mcc?: string
    merchantId?: string
    txnRef?: string
    amount?: number
    currency?: string
    note?: string
    scanLocation?: { lat: number; lon: number }
    appVersion?: string
    deviceId?: string
    payerRole?: PaymentPayerRole
  }) => api.post<PaymentRequestApiResponse>("/payments/qr-scan", body),

  createDirectPaymentRequest: (body: {
    taskId: string
    amount: number
    currency?: string
    note?: string
    appVersion?: string
    deviceId?: string
    payerRole?: PaymentPayerRole
  }) => api.post<PaymentRequestApiResponse>("/payments/direct", body),

  getPaymentRequest: (id: string) => api.get<PaymentRequestApiResponse>(`/payments/${id}`),

  getActivePaymentRequest: (taskId: string) =>
    api.get<PaymentRequestApiResponse>(`/payments/task/${taskId}/active`),

  getActivePaymentOptions: (taskId: string) =>
    api.get<PaymentRequestApiResponse[]>(`/payments/task/${taskId}/active-options`),

  initiatePayment: (id: string) => api.post(`/payments/${id}/initiate`, {}),

  markPaid: (id: string, payload: { paidAmount?: number; proofUrl?: string }) =>
    api.post(`/payments/${id}/mark-paid`, payload),

  getMyPaymentProfile: () => api.get<PaymentProfileApiResponse>("/payment-profile/me"),
  getMyPaymentProfileForEdit: () =>
    api.get<PaymentProfileEditApiResponse>("/payment-profile/me/edit"),
  createPaymentProfile: (body: {
    upiId: string
    payeeLabel?: string
    sourceType: PaymentProfileSourceType
  }) => api.post<PaymentProfileEditApiResponse>("/payment-profile", body),
  updatePaymentProfile: (body: {
    upiId: string
    payeeLabel?: string
    sourceType: PaymentProfileSourceType
  }) => api.put<PaymentProfileEditApiResponse>("/payment-profile", body),
  deletePaymentProfile: () => api.delete("/payment-profile"),

  // In-app notification inbox
  getNotifications: (page = 0, size = 20) =>
    api.get<Page<UserNotification>>(`/notifications?page=${page}&size=${size}`),
  getUnreadCount: () => api.get<UnreadCountResponse>("/notifications/unread-count"),
  markNotificationRead: (id: string) => api.patch<UserNotification>(`/notifications/${id}/read`),
  markAllRead: () => api.patch("/notifications/read-all"),
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
