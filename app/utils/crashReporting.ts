import {
  getCrashlytics,
  setCrashlyticsCollectionEnabled as sdkSetCollectionEnabled,
  recordError as sdkRecordError,
  setUserId as sdkSetUserId,
  log as sdkLog,
  setAttribute as sdkSetAttribute,
  setAttributes as sdkSetAttributes,
} from "@react-native-firebase/crashlytics"
import { getRemoteFlag } from "@/services/remoteConfig"

// Cached modular Crashlytics instance.
const crashlyticsInstance = getCrashlytics()

export const initCrashReporting = (): void => {
  sdkSetCollectionEnabled(crashlyticsInstance, !__DEV__)
}

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

// Gated behind crashlytics_user_context_enabled — allows disabling PII attachment
// in privacy-sensitive regions or for user opt-out flows.
export const setUserId = (userId: string): void => {
  if (!getRemoteFlag("crashlytics_user_context_enabled")) return
  sdkSetUserId(crashlyticsInstance, userId).catch(() => {})
}

export const clearUserId = (): void => {
  sdkSetUserId(crashlyticsInstance, "").catch(() => {})
}

export const log = (message: string): void => {
  sdkLog(crashlyticsInstance, message)
}

export const setAttribute = (key: string, value: string): void => {
  if (!getRemoteFlag("crashlytics_user_context_enabled")) return
  sdkSetAttribute(crashlyticsInstance, key, value).catch(() => {})
}

// Called from remoteConfig.ts after fetchAndActivate completes.
// Attaches active rollout state so crash reports can be correlated with Console changes.
export const setRemoteConfigAttributes = (): void => {
  const featureFlags = [
    getRemoteFlag("feature_help_requests_enabled") && "help_requests",
    getRemoteFlag("feature_audio_upload_enabled") && "audio_upload",
    getRemoteFlag("feature_location_capture_enabled") && "location",
    getRemoteFlag("feature_push_registration_enabled") && "push",
  ]
    .filter(Boolean)
    .join(",")

  sdkSetAttributes(crashlyticsInstance, {
    rc_maintenance_mode: String(getRemoteFlag("maintenance_mode_enabled")),
    rc_force_update: String(getRemoteFlag("force_update_enabled")),
    rc_fetch_status: "activated",
    rc_feature_flags: featureFlags,
  }).catch(() => {})
}
