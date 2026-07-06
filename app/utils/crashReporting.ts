import {
  getCrashlytics,
  setCrashlyticsCollectionEnabled as sdkSetCollectionEnabled,
  recordError as sdkRecordError,
  setUserId as sdkSetUserId,
  log as firebaseLog,
  setAttribute as sdkSetAttribute,
  setAttributes as sdkSetAttributes,
} from "@react-native-firebase/crashlytics"
import { Platform } from "react-native"
import { getRemoteFlag } from "@/services/remoteConfig"

const crashlyticsInstance = getCrashlytics()

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

export const initCrashReporting = (): void => {
  sdkSetCollectionEnabled(crashlyticsInstance, !__DEV__)
}

// ---------------------------------------------------------------------------
// Error types and fatal/non-fatal recording
// ---------------------------------------------------------------------------

export enum ErrorType {
  FATAL = "Fatal",
  HANDLED = "Handled",
}

export const reportCrash = (error: Error, type: ErrorType = ErrorType.FATAL): void => {
  if (__DEV__) {
    console.error(error)
    console.log(error.message || "Unknown", type)
  } else {
    sdkRecordError(crashlyticsInstance, error)
  }
}

// ---------------------------------------------------------------------------
// User identity — gated by crashlytics_user_context_enabled
// ---------------------------------------------------------------------------

export const setUserId = (userId: string): void => {
  if (!getRemoteFlag("crashlytics_user_context_enabled")) return
  sdkSetUserId(crashlyticsInstance, userId).catch(() => {})
}

export const clearUserId = (): void => {
  sdkSetUserId(crashlyticsInstance, "").catch(() => {})
}

// ---------------------------------------------------------------------------
// Internal write helpers (not exported)
// ---------------------------------------------------------------------------

function safeAttr(key: string, value: string): void {
  sdkSetAttribute(crashlyticsInstance, key, value).catch(() => {})
}

function safeAttrs(attrs: Record<string, string>): void {
  sdkSetAttributes(crashlyticsInstance, attrs).catch(() => {})
}

function writeLog(message: string): void {
  firebaseLog(crashlyticsInstance, message)
}

// ---------------------------------------------------------------------------
// Breadcrumb — public timeline log, gated by crashlytics_breadcrumbs_enabled
// Format: "domain:event key=value key=value"
// ---------------------------------------------------------------------------

export const breadcrumb = (message: string): void => {
  if (!getRemoteFlag("crashlytics_breadcrumbs_enabled")) return
  writeLog(message)
}

// ---------------------------------------------------------------------------
// App / Build context — ungated (build facts, no PII)
// Call once from app.tsx after initCrashReporting().
// ---------------------------------------------------------------------------

export const setAppBuildContext = (opts: {
  appVersion: string
  buildNumber: string
  appEnv: string
  locale: string
}): void => {
  safeAttrs({
    app_env: opts.appEnv,
    app_version: opts.appVersion,
    build_number: opts.buildNumber,
    platform: Platform.OS,
    locale: opts.locale,
  })
}

// ---------------------------------------------------------------------------
// Session context — ungated (screen names and app state are not PII)
// ---------------------------------------------------------------------------

export const setSessionContext = (opts: {
  screenCurrent?: string
  screenPrevious?: string
  appForegroundState?: "active" | "background" | "inactive"
}): void => {
  const attrs: Record<string, string> = {}
  if (opts.screenCurrent !== undefined) attrs.screen_current = opts.screenCurrent
  if (opts.screenPrevious !== undefined) attrs.screen_previous = opts.screenPrevious
  if (opts.appForegroundState !== undefined) attrs.app_foreground_state = opts.appForegroundState
  if (Object.keys(attrs).length > 0) safeAttrs(attrs)
}

// ---------------------------------------------------------------------------
// Auth context — gated by crashlytics_user_context_enabled
// ---------------------------------------------------------------------------

export const setAuthContext = (opts: {
  authHasToken: boolean
  authMethodLast?: string
  authStepLast?: string
  authErrorKindLast?: string
}): void => {
  if (!getRemoteFlag("crashlytics_user_context_enabled")) return
  const attrs: Record<string, string> = {
    auth_has_token: String(opts.authHasToken),
    session_auth_state: opts.authHasToken ? "authenticated" : "anonymous",
  }
  if (opts.authMethodLast !== undefined) attrs.auth_method_last = opts.authMethodLast
  if (opts.authStepLast !== undefined) attrs.auth_step_last = opts.authStepLast
  if (opts.authErrorKindLast !== undefined) attrs.auth_error_kind_last = opts.authErrorKindLast
  safeAttrs(attrs)
}

// ---------------------------------------------------------------------------
// User role context — gated by crashlytics_user_context_enabled
// ---------------------------------------------------------------------------

export const setUserRoleContext = (role: "neta" | "karyakarta" | "unknown"): void => {
  if (!getRemoteFlag("crashlytics_user_context_enabled")) return
  safeAttr("session_role", role)
}

// ---------------------------------------------------------------------------
// Location context — gated by crashlytics_location_context_enabled
// No coordinates, addresses, or place names.
// ---------------------------------------------------------------------------

export const setLocationContext = (opts: {
  permission: "granted" | "denied" | "blocked" | "unknown"
  accuracyBucket?: "high" | "medium" | "low" | "unknown"
  ageBucket?: "fresh" | "stale" | "missing"
}): void => {
  if (!getRemoteFlag("crashlytics_location_context_enabled")) return
  const attrs: Record<string, string> = {
    location_permission: opts.permission,
  }
  if (opts.accuracyBucket !== undefined) attrs.location_accuracy_bucket = opts.accuracyBucket
  if (opts.ageBucket !== undefined) attrs.location_age_bucket = opts.ageBucket
  safeAttrs(attrs)
}

// ---------------------------------------------------------------------------
// Request / task context — gated by crashlytics_user_context_enabled
// ---------------------------------------------------------------------------

export const setRequestContext = (opts: {
  taskContext: "create" | "feed" | "detail" | "active" | "unknown"
  taskStatus?: string
  taskRole?: "requester" | "helper" | "viewer"
  taskIdShort?: string
  taskHasAudio?: boolean
  taskHasPayment?: boolean
}): void => {
  if (!getRemoteFlag("crashlytics_user_context_enabled")) return
  const attrs: Record<string, string> = {
    task_context: opts.taskContext,
  }
  if (opts.taskStatus !== undefined) attrs.task_status = opts.taskStatus.toLowerCase()
  if (opts.taskRole !== undefined) attrs.task_role = opts.taskRole
  if (opts.taskIdShort !== undefined) attrs.task_id_short = opts.taskIdShort
  if (opts.taskHasAudio !== undefined) attrs.task_has_audio = String(opts.taskHasAudio)
  if (opts.taskHasPayment !== undefined) attrs.task_has_payment = String(opts.taskHasPayment)
  safeAttrs(attrs)
}

export const clearRequestContext = (): void => {
  if (!getRemoteFlag("crashlytics_user_context_enabled")) return
  safeAttrs({
    task_context: "unknown",
    task_status: "",
    task_role: "",
    task_id_short: "",
    task_has_audio: "false",
    task_has_payment: "false",
  })
}

// ---------------------------------------------------------------------------
// Payment context — gated by crashlytics_payment_context_enabled
// ---------------------------------------------------------------------------

function bucketAmount(amountInr?: number): string {
  if (amountInr == null || !Number.isFinite(amountInr)) return "unknown"
  if (amountInr < 100) return "lt_100"
  if (amountInr < 500) return "100_499"
  if (amountInr < 1000) return "500_999"
  if (amountInr < 5000) return "1000_4999"
  return "5000_plus"
}

export const setPaymentContext = (opts: {
  paymentContext: string
  paymentMode?: string
  paymentStatus?: string
  paymentAmountInr?: number
  paymentFlow?: string
}): void => {
  if (!getRemoteFlag("crashlytics_payment_context_enabled")) return
  const attrs: Record<string, string> = {
    payment_context: opts.paymentContext,
  }
  if (opts.paymentMode !== undefined) attrs.payment_mode = opts.paymentMode
  if (opts.paymentStatus !== undefined) attrs.payment_status = opts.paymentStatus.toLowerCase()
  attrs.payment_amount_bucket = bucketAmount(opts.paymentAmountInr)
  if (opts.paymentFlow !== undefined) attrs.payment_flow = opts.paymentFlow
  safeAttrs(attrs)
}

export const clearPaymentContext = (): void => {
  if (!getRemoteFlag("crashlytics_payment_context_enabled")) return
  safeAttrs({
    payment_context: "",
    payment_mode: "",
    payment_status: "",
    payment_amount_bucket: "unknown",
    payment_flow: "",
  })
}

// ---------------------------------------------------------------------------
// API failure context — not gated by user_context (HTTP data is not PII)
// Gated by crashlytics_api_error_context_enabled.
// ---------------------------------------------------------------------------

function normalizeUrlPath(url: string): string {
  return url
    .toLowerCase()
    .split(/[?#]/)[0]
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/^\/+/, "")
}

function hasPathSegment(path: string, segment: string): boolean {
  return (
    path === segment ||
    path.startsWith(`${segment}/`) ||
    path.includes(`/${segment}/`) ||
    path.endsWith(`/${segment}`)
  )
}

function hasAnyPathSegment(path: string, segments: string[]): boolean {
  return segments.some((segment) => hasPathSegment(path, segment))
}

export function mapUrlToDomain(url?: string | null): string {
  if (!url) return "unknown"
  const path = normalizeUrlPath(url)
  if (hasAnyPathSegment(path, ["auth", "otp", "token"])) return "auth"
  if (hasAnyPathSegment(path, ["tasks", "requests", "help-requests"])) return "tasks"
  if (hasAnyPathSegment(path, ["payments", "payment-profile"])) return "payments"
  if (hasAnyPathSegment(path, ["profile", "users"])) return "profile"
  if (hasAnyPathSegment(path, ["notifications", "push"])) return "notifications"
  if (hasPathSegment(path, "reports")) return "reports"
  if (hasAnyPathSegment(path, ["upload", "uploads", "presigned", "pre-signed", "media"])) return "upload"
  return "unknown"
}

function bucketDuration(ms?: number): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "unknown"
  if (ms < 500) return "lt_500ms"
  if (ms < 1000) return "500ms_1s"
  if (ms < 3000) return "1s_3s"
  if (ms < 10000) return "3s_10s"
  return "10s_plus"
}

let lastApiFailureDomain: string | null = null

export const setApiFailureContext = (opts: {
  url?: string | null
  method?: string
  status?: number | null
  errorKind?: string
  retryable?: boolean
  durationMs?: number
}): void => {
  if (!getRemoteFlag("crashlytics_api_error_context_enabled")) return
  lastApiFailureDomain = mapUrlToDomain(opts.url)
  safeAttrs({
    api_last_domain: lastApiFailureDomain,
    api_last_method: (opts.method ?? "unknown").toUpperCase(),
    api_last_status: String(opts.status ?? "unknown"),
    api_last_error_kind: opts.errorKind ?? "unknown",
    api_last_retryable: String(opts.retryable ?? false),
    api_last_duration_bucket: bucketDuration(opts.durationMs),
  })
}

export const clearApiFailureContext = (domain?: string): void => {
  if (!getRemoteFlag("crashlytics_api_error_context_enabled")) return
  if (!lastApiFailureDomain) return
  if (domain && domain !== lastApiFailureDomain) return
  lastApiFailureDomain = null
  safeAttrs({
    api_last_domain: "",
    api_last_method: "",
    api_last_status: "",
    api_last_error_kind: "",
    api_last_retryable: "",
    api_last_duration_bucket: "",
  })
}

// ---------------------------------------------------------------------------
// recordHandledError — non-fatal with API context attached
// ---------------------------------------------------------------------------

export const recordHandledError = (
  error: Error,
  opts?: {
    url?: string | null
    method?: string
    status?: number | null
    errorKind?: string
    retryable?: boolean
    durationMs?: number
  },
): void => {
  if (opts) setApiFailureContext(opts)
  reportCrash(error, ErrorType.HANDLED)
}

// ---------------------------------------------------------------------------
// Remote Config attributes — called after fetchAndActivate
// ---------------------------------------------------------------------------

export const setRemoteConfigAttributes = (): void => {
  const featureFlags = [
    getRemoteFlag("feature_help_requests_enabled") && "help_requests",
    getRemoteFlag("feature_audio_upload_enabled") && "audio_upload",
    getRemoteFlag("feature_location_capture_enabled") && "location",
    getRemoteFlag("feature_push_registration_enabled") && "push",
  ]
    .filter(Boolean)
    .join(",")

  safeAttrs({
    rc_maintenance_mode: String(getRemoteFlag("maintenance_mode_enabled")),
    rc_force_update: String(getRemoteFlag("force_update_enabled")),
    rc_fetch_status: "activated",
    rc_feature_flags: featureFlags,
  })
}

// ---------------------------------------------------------------------------
// Legacy compat — existing callers that use setAttribute still compile.
// New code should use the domain-specific helpers above.
// ---------------------------------------------------------------------------

export const setAttribute = (key: string, value: string): void => {
  if (!getRemoteFlag("crashlytics_user_context_enabled")) return
  safeAttr(key, value)
}
