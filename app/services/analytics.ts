import { getApp } from "@react-native-firebase/app"
import {
  getAnalytics,
  logEvent as firebaseLogEvent,
  setUserId as firebaseSetUserId,
  setUserProperties,
  setAnalyticsCollectionEnabled,
} from "@react-native-firebase/analytics"
import { getAuthConfig, getRemoteFlag } from "@/services/remoteConfig"

// Cached modular Analytics instance.
const analyticsInstance = getAnalytics(getApp())

// ---------------------------------------------------------------------------
// Core helpers
// ---------------------------------------------------------------------------

export const logScreenView = (screenName: string, screenClass?: string): void => {
  firebaseLogEvent(analyticsInstance, "screen_view", {
    screen_name: screenName,
    screen_class: screenClass ?? screenName,
  }).catch(() => {})
}

export const logEvent = (name: string, params?: Record<string, unknown>): void => {
  firebaseLogEvent(analyticsInstance, name, params)
    .catch(() => {})
}

export const setUserId = (userId: string | null): void => {
  firebaseSetUserId(analyticsInstance, userId)
    .catch(() => {})
}

export const setUserProperty = (name: string, value: string | null): void => {
  setUserProperties(analyticsInstance, { [name]: value })
    .catch(() => {})
}

// Called from remoteConfig.ts after fetchAndActivate completes.
// Two responsibilities:
//   1. Enable/disable Analytics collection in __DEV__ based on the remote flag
//      (production collection is never affected — the __DEV__ guard is mandatory).
//   2. Log a single event with selected non-sensitive flag values so dashboards
//      can correlate behaviour with active rollout state.
export const logRemoteConfigActivated = (): void => {
  if (__DEV__) {
    const debugLoggingEnabled = getRemoteFlag("analytics_debug_logging_enabled")
    setAnalyticsCollectionEnabled(analyticsInstance, debugLoggingEnabled).catch(() => {})
  }

  const { googleEnabled, phoneOtpEnabled } = getAuthConfig()
  const activeMethods = [googleEnabled && "google", phoneOtpEnabled && "otp"].filter(Boolean).join(",")

  logEvent("remote_config_activated", {
    maintenance_mode_enabled: getRemoteFlag("maintenance_mode_enabled"),
    force_update_enabled: getRemoteFlag("force_update_enabled"),
    feature_help_requests_enabled: getRemoteFlag("feature_help_requests_enabled"),
    feature_audio_upload_enabled: getRemoteFlag("feature_audio_upload_enabled"),
    active_auth_methods: activeMethods,
  })
}

// ---------------------------------------------------------------------------
// Typed event catalogue
// Centralising event names prevents string typos across call sites.
// ---------------------------------------------------------------------------

// "user_initiated" — logout button tap. "session_expired" — forced logout from
// a failed/expired token. "account_locked" — blocked/deleted account (by an
// admin). "account_deleted" — the user deleted their own account.
export type LogoutReason =
  | "user_initiated"
  | "session_expired"
  | "account_locked"
  | "account_deleted"

export const AnalyticsEvent = {
  // Session
  APP_SESSION_STARTED: "app_session_started",

  // Auth — OTP
  LOGIN_STARTED: "login_started",
  LOGIN_SUCCESS: "login_success",
  LOGIN_FAILED: "login_failed",
  OTP_REQUESTED: "otp_requested",
  OTP_VERIFIED: "otp_verified",
  OTP_FAILED: "otp_failed",
  LOGOUT: "logout",

  // Auth — Google
  GOOGLE_LOGIN_SUCCESS: "google_login_success",
  GOOGLE_LOGIN_FAILED: "google_login_failed",

  // Help requests
  HELP_REQUEST_CREATED: "help_request_created",
  HELP_REQUEST_ACCEPTED: "help_request_accepted",
  HELP_REQUEST_COMPLETED: "help_request_completed",
  HELP_REQUEST_CANCELLED: "help_request_cancelled",

  // Permissions
  LOCATION_PERMISSION_GRANTED: "location_permission_granted",
  LOCATION_PERMISSION_DENIED: "location_permission_denied",
  PUSH_PERMISSION_GRANTED: "push_permission_granted",
  PUSH_PERMISSION_DENIED: "push_permission_denied",

  // Onboarding funnel
  ONBOARDING_WELCOME_VIEWED: "onboarding_welcome_viewed",
  ONBOARDING_INTENT_SELECTED: "onboarding_intent_selected",
  ONBOARDING_FIRST_ACTION: "onboarding_first_action",
  ONBOARDING_GRADUATED: "onboarding_graduated",

  // Feedback prompts (creation / completion) — params carry { event: "creation" | "completion", taskId }
  FEEDBACK_PROMPT_SHOWN: "feedback_prompt_shown",
  FEEDBACK_PROMPT_SUBMITTED: "feedback_prompt_submitted",
  FEEDBACK_PROMPT_SKIPPED: "feedback_prompt_skipped",
  FEEDBACK_LATER_ALERT_SHOWN: "feedback_later_alert_shown",
} as const

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent]
