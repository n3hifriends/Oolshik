import { useEffect, useState } from "react"
import { getApp } from "@react-native-firebase/app"
import {
  getRemoteConfig,
  setConfigSettings,
  setDefaults,
  fetchAndActivate,
  getValue,
} from "@react-native-firebase/remote-config"

// ---------------------------------------------------------------------------
// Key registry — lowercase snake_case matches Firebase Console convention.
// SCREAMING_SNAKE_CASE stays for Config.* build-time env vars only.
// ---------------------------------------------------------------------------

export interface RemoteConfigFlags {
  // Feature flags
  feature_help_requests_enabled: boolean
  feature_audio_upload_enabled: boolean
  feature_location_capture_enabled: boolean
  feature_push_registration_enabled: boolean

  // Auth flags — UX only; backend validates tokens regardless
  auth_phone_otp_enabled: boolean
  auth_google_enabled: boolean
  auth_google_require_phone: boolean

  // UI / Content
  home_banner_enabled: boolean
  home_banner_type: string
  home_banner_id: string
  home_banner_title: string
  home_banner_message: string
  home_banner_auto_dismiss_seconds: number
  support_contact_whatsapp: string
  support_contact_email: string
  feature_help_requests_disabled_message: string

  // Operational controls
  maintenance_mode_enabled: boolean
  maintenance_message: string
  min_supported_app_version_android: string
  min_supported_app_version_ios: string
  force_update_enabled: boolean
  audio_upload_use_presigned: boolean
  help_request_poll_interval_ms: number
  remote_config_fetch_interval_seconds: number

  // Privacy / Observability
  analytics_debug_logging_enabled: boolean
  crashlytics_user_context_enabled: boolean

  // Debug flags — dev/staging only; never enable in production Console
  mock_nearby_enabled: boolean
  mock_upload_create_enabled: boolean
}

const DEFAULTS: RemoteConfigFlags = {
  feature_help_requests_enabled: true,
  feature_audio_upload_enabled: true,
  feature_location_capture_enabled: true,
  feature_push_registration_enabled: true,

  auth_phone_otp_enabled: false,
  auth_google_enabled: true,
  auth_google_require_phone: true,

  home_banner_enabled: false,
  home_banner_type: "info",
  home_banner_id: "",
  home_banner_title: "",
  home_banner_message: "",
  home_banner_auto_dismiss_seconds: 0,
  support_contact_whatsapp: "",
  support_contact_email: "",
  feature_help_requests_disabled_message: "",

  maintenance_mode_enabled: false,
  maintenance_message: "",
  min_supported_app_version_android: "0.0.0",
  min_supported_app_version_ios: "0.0.0",
  force_update_enabled: false,
  audio_upload_use_presigned: false,
  help_request_poll_interval_ms: 10_000,
  remote_config_fetch_interval_seconds: 3600,

  analytics_debug_logging_enabled: false,
  crashlytics_user_context_enabled: true,

  mock_nearby_enabled: false,
  mock_upload_create_enabled: false,
}

// ---------------------------------------------------------------------------
// Module-level listener set — notified after every fetchAndActivate.
// useRemoteConfig() subscribes here so components re-render on activation.
// ---------------------------------------------------------------------------

const activationListeners = new Set<() => void>()
let initialized = false

const notifyActivationListeners = (): void => {
  activationListeners.forEach((fn) => fn())
}

// Cached modular RC instance — avoids repeated getApp() calls on every flag read.
const rc = getRemoteConfig(getApp())

const getConfiguredFetchIntervalMs = (): number => {
  if (__DEV__) return 0
  const rawSeconds = getRemoteFlag("remote_config_fetch_interval_seconds")
  return Math.min(Math.max(rawSeconds, 300), 86_400) * 1000
}

// ---------------------------------------------------------------------------
// initRemoteConfig — fire-and-forget from index.tsx before registerRootComponent.
// Network failures are swallowed; app continues with DEFAULTS or last cache.
// ---------------------------------------------------------------------------

export const initRemoteConfig = async (): Promise<void> => {
  try {
    const intervalMs = __DEV__ ? 0 : 3_600_000
    await setConfigSettings(rc, { minimumFetchIntervalMillis: intervalMs })
    await setDefaults(rc, DEFAULTS as unknown as Record<string, string | number | boolean>)
    await fetchAndActivate(rc)
    initialized = true

    if (!__DEV__) {
      // After first activation, apply the remotely-controlled fetch interval for subsequent fetches.
      // Clamped: [300, 86400] seconds — prevents hammering Firebase quota or locking out refreshes.
      await setConfigSettings(rc, { minimumFetchIntervalMillis: getConfiguredFetchIntervalMs() })
    }

    // Lazy imports avoid circular dependency: analytics/crashReporting → remoteConfig → analytics.
    const [{ logRemoteConfigActivated }, { setRemoteConfigAttributes }] = await Promise.all([
      import("@/services/analytics"),
      import("@/utils/crashReporting"),
    ])
    logRemoteConfigActivated()
    setRemoteConfigAttributes()
  } catch (e) {
    console.warn("[RemoteConfig] fetchAndActivate failed:", e)
  } finally {
    initialized = true
    notifyActivationListeners()
  }
}

// ---------------------------------------------------------------------------
// forceRefetchRemoteConfig — bypasses minimumFetchIntervalMillis.
// Use from MaintenanceScreen / ForceUpdateScreen Retry buttons only.
// Calling initRemoteConfig() from those screens would respect the cached
// interval and may return cached state, keeping the user trapped.
// ---------------------------------------------------------------------------

export const forceRefetchRemoteConfig = async (): Promise<void> => {
  try {
    await setConfigSettings(rc, { minimumFetchIntervalMillis: 0 })
    await fetchAndActivate(rc)
  } catch (e) {
    console.warn("[RemoteConfig] forceRefetch failed:", e)
  } finally {
    await setConfigSettings(rc, { minimumFetchIntervalMillis: getConfiguredFetchIntervalMs() }).catch(() => {})
    notifyActivationListeners()
  }
}

// ---------------------------------------------------------------------------
// getRemoteFlag — synchronous read; safe anywhere after initRemoteConfig fires.
// Falls back to DEFAULTS before first activation.
// ---------------------------------------------------------------------------

export const getRemoteFlag = <K extends keyof RemoteConfigFlags>(key: K): RemoteConfigFlags[K] => {
  const defaultValue = DEFAULTS[key]
  if (!initialized) return defaultValue

  const configValue = getValue(rc, key)

  switch (typeof defaultValue) {
    case "boolean":
      return configValue.asBoolean() as RemoteConfigFlags[K]
    case "number": {
      const value = configValue.asNumber()
      return (Number.isFinite(value) ? value : defaultValue) as RemoteConfigFlags[K]
    }
    default:
      return configValue.asString() as RemoteConfigFlags[K]
  }
}

// ---------------------------------------------------------------------------
// Typed domain accessors — callers import these, not raw string keys.
// ---------------------------------------------------------------------------

export const isFeatureEnabled = (key: "feature_help_requests_enabled" | "feature_audio_upload_enabled" | "feature_location_capture_enabled" | "feature_push_registration_enabled"): boolean =>
  getRemoteFlag(key)

export const getAuthConfig = () => ({
  phoneOtpEnabled: getRemoteFlag("auth_phone_otp_enabled"),
  googleEnabled: getRemoteFlag("auth_google_enabled"),
  googleRequirePhone: getRemoteFlag("auth_google_require_phone"),
})

export const getMaintenanceConfig = () => ({
  enabled: getRemoteFlag("maintenance_mode_enabled"),
  message: getRemoteFlag("maintenance_message"),
})

export const getVersionConfig = () => ({
  minAndroid: getRemoteFlag("min_supported_app_version_android"),
  minIos: getRemoteFlag("min_supported_app_version_ios"),
  forceUpdateEnabled: getRemoteFlag("force_update_enabled"),
})

export const getBannerConfig = () => ({
  enabled: getRemoteFlag("home_banner_enabled"),
  title: getRemoteFlag("home_banner_title"),
  message: getRemoteFlag("home_banner_message"),
})

export const getSupportContactConfig = () => ({
  whatsapp: getRemoteFlag("support_contact_whatsapp"),
  email: getRemoteFlag("support_contact_email"),
})

// ---------------------------------------------------------------------------
// useRemoteConfig — React hook; re-renders when fetchAndActivate activates.
// Use in components/hooks. For non-React code use getRemoteFlag() directly.
// ---------------------------------------------------------------------------

const buildFlags = (): RemoteConfigFlags =>
  (Object.keys(DEFAULTS) as Array<keyof RemoteConfigFlags>).reduce(
    (acc, key) => {
      acc[key] = getRemoteFlag(key) as never
      return acc
    },
    {} as RemoteConfigFlags,
  )

export const useRemoteConfig = (): RemoteConfigFlags => {
  const [flags, setFlags] = useState<RemoteConfigFlags>(() => (initialized ? buildFlags() : DEFAULTS))

  useEffect(() => {
    const refresh = () => setFlags(buildFlags())
    activationListeners.add(refresh)
    return () => {
      activationListeners.delete(refresh)
    }
  }, [])

  return flags
}
