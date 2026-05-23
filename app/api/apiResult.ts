import { ApiResponse } from "apisauce"

export type AppApiErrorKind =
  | "network"
  | "timeout"
  | "upstream"
  | "server"
  | "unauthorized"
  | "forbidden"
  | "not-found"
  | "validation"
  | "conflict"
  | "rate-limited"
  | "rejected"
  | "bad-data"
  | "unknown"

export type AppApiError = {
  kind: AppApiErrorKind
  temporary: boolean
  status?: number
  message?: string
  requestId?: string
  retryAfterMs?: number
  rawProblem?: string | null
}

export type ApiResult<T> =
  | {
      ok: true
      data: T
      meta?: {
        requestId?: string
      }
    }
  | {
      ok: false
      error: AppApiError
    }

type RetryOptions = {
  attempts?: number
  baseDelayMs?: number
  maxDelayMs?: number
  shouldRetry?: (error: AppApiError) => boolean
}

export function normalizeApiError<T>(response: ApiResponse<T>): AppApiError {
  const status = response.status ?? undefined
  const headers = response.headers
  const requestId = extractRequestId(headers)
  const retryAfterMs = extractRetryAfterMs(headers)
  const message = extractApiMessage(response.data, headers)

  switch (response.problem) {
    case "CONNECTION_ERROR":
    case "NETWORK_ERROR":
      return {
        kind: "network",
        temporary: true,
        status,
        message,
        requestId,
        retryAfterMs,
        rawProblem: response.problem,
      }
    case "TIMEOUT_ERROR":
      return {
        kind: "timeout",
        temporary: true,
        status,
        message,
        requestId,
        retryAfterMs,
        rawProblem: response.problem,
      }
    case "SERVER_ERROR":
      return {
        kind: status === 502 || status === 503 || status === 504 ? "upstream" : "server",
        temporary: true,
        status,
        message,
        requestId,
        retryAfterMs,
        rawProblem: response.problem,
      }
    case "UNKNOWN_ERROR":
      return {
        kind: "unknown",
        temporary: true,
        status,
        message,
        requestId,
        retryAfterMs,
        rawProblem: response.problem,
      }
    case "CLIENT_ERROR":
      switch (status) {
        case 400:
          return {
            kind: "validation",
            temporary: false,
            status,
            message,
            requestId,
            retryAfterMs,
            rawProblem: response.problem,
          }
        case 401:
          return {
            kind: "unauthorized",
            temporary: false,
            status,
            message,
            requestId,
            retryAfterMs,
            rawProblem: response.problem,
          }
        case 403:
          return {
            kind: "forbidden",
            temporary: false,
            status,
            message,
            requestId,
            retryAfterMs,
            rawProblem: response.problem,
          }
        case 404:
          return {
            kind: "not-found",
            temporary: false,
            status,
            message,
            requestId,
            retryAfterMs,
            rawProblem: response.problem,
          }
        case 409:
          return {
            kind: "conflict",
            temporary: false,
            status,
            message,
            requestId,
            retryAfterMs,
            rawProblem: response.problem,
          }
        case 429:
          return {
            kind: "rate-limited",
            temporary: true,
            status,
            message,
            requestId,
            retryAfterMs,
            rawProblem: response.problem,
          }
        default:
          return {
            kind: "rejected",
            temporary: false,
            status,
            message,
            requestId,
            retryAfterMs,
            rawProblem: response.problem,
          }
      }
    case "CANCEL_ERROR":
      return {
        kind: "unknown",
        temporary: false,
        status,
        message,
        requestId,
        retryAfterMs,
        rawProblem: response.problem,
      }
    default:
      return {
        kind: "unknown",
        temporary: true,
        status,
        message,
        requestId,
        retryAfterMs,
        rawProblem: response.problem ?? null,
      }
  }
}

export function isTemporaryApiError(error: AppApiError) {
  return error.temporary
}

export async function requestWithRetry<T>(
  execute: () => Promise<ApiResponse<T>>,
  options: RetryOptions = {},
): Promise<ApiResponse<T>> {
  const attempts = Math.max(1, options.attempts ?? 3)
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 300)
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 1200)
  const shouldRetry = options.shouldRetry ?? isTemporaryApiError

  let attempt = 0
  let response = await execute()

  while (!response.ok && attempt < attempts - 1) {
    const error = normalizeApiError(response)
    if (!shouldRetry(error)) {
      break
    }

    const backoffMs = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt)
    const jitterMs = Math.floor(Math.random() * Math.max(1, Math.round(backoffMs * 0.25)))
    const waitMs =
      typeof error.retryAfterMs === "number" && error.retryAfterMs > 0
        ? error.retryAfterMs
        : backoffMs + jitterMs
    await delay(waitMs)

    attempt += 1
    response = await execute()
  }

  return response
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractRequestId(headers?: Record<string, unknown>) {
  const value =
    headers?.["x-correlation-id"] ??
    headers?.["X-Correlation-Id"] ??
    headers?.["x-request-id"] ??
    headers?.["X-Request-Id"]

  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

function extractRetryAfterMs(headers?: Record<string, unknown>) {
  const value = headers?.["retry-after"] ?? headers?.["Retry-After"]
  if (typeof value !== "string") return undefined

  const seconds = Number(value)
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000
  }
  return undefined
}

function extractApiMessage(data: unknown, headers?: Record<string, unknown>) {
  const contentType = getHeader(headers, "content-type")
  if (contentType?.includes("text/html")) return undefined

  if (isRecord(data)) {
    const message = data.message
    if (typeof message === "string" && message.trim().length > 0) return message

    const error = data.error
    if (typeof error === "string" && error.trim().length > 0) return error
  }

  if (typeof data === "string") {
    const trimmed = data.trim()
    if (trimmed.length > 0 && trimmed.length <= 240 && !trimmed.startsWith("<html")) {
      return trimmed
    }
  }

  return undefined
}

function getHeader(headers: Record<string, unknown> | undefined, name: string) {
  if (!headers) return undefined
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === lower && typeof value === "string") {
      return value.toLowerCase()
    }
  }
  return undefined
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}
