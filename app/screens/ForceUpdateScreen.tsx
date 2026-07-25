import { useRef, useState } from "react"
import { Linking, Platform } from "react-native"
import * as Application from "expo-application"
import { useTranslation } from "react-i18next"

import { AppGateScreen } from "@/components/AppGateScreen"
import { useOnForeground } from "@/hooks/useOnForeground"
import { forceRefetchRemoteConfig, getVersionConfig } from "@/services/remoteConfig"

// Hardcoded build-time constants — never sourced from Remote Config.
// A broken Remote Config URL on this screen would trap users with no escape.
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.oolshik.aan"
const APP_STORE_URL = "https://apps.apple.com/app/id6744416843"

// Foreground recheck is a passive convenience, not a user action — throttle it
// so rapid app-switching doesn't spam Firebase Remote Config fetches. Manual
// retry (the button) always bypasses this and checks immediately.
const MIN_FOREGROUND_RECHECK_MS = 30_000

export function ForceUpdateScreen() {
  const { t } = useTranslation()
  const [retrying, setRetrying] = useState(false)
  const [storeOpenFailed, setStoreOpenFailed] = useState(false)

  const currentVersion = Application.nativeApplicationVersion ?? "—"
  const { minAndroid, minIos } = getVersionConfig()
  const minVersion = Platform.OS === "android" ? minAndroid : minIos
  const storeUrl = Platform.OS === "android" ? PLAY_STORE_URL : APP_STORE_URL

  const handleUpdate = async () => {
    setStoreOpenFailed(false)
    try {
      await Linking.openURL(storeUrl)
    } catch {
      setStoreOpenFailed(true)
    }
  }

  const lastCheckedAtRef = useRef(0)

  const handleRetry = async () => {
    setRetrying(true)
    setStoreOpenFailed(false)
    lastCheckedAtRef.current = Date.now()
    await forceRefetchRemoteConfig()
    setRetrying(false)
  }

  // App comes back to the foreground after the user visits the store — recheck
  // silently so a rolled-back force-update (or a bad min-version push) clears
  // without requiring the user to notice and tap "I've updated" themselves.
  // Throttled: skip if a check (manual or foreground) already ran recently.
  useOnForeground(() => {
    if (Date.now() - lastCheckedAtRef.current < MIN_FOREGROUND_RECHECK_MS) return
    lastCheckedAtRef.current = Date.now()
    forceRefetchRemoteConfig()
  })

  const versionDetails =
    t("oolshik:forceUpdateScreen.currentVersion", { version: currentVersion }) +
    "   ·   " +
    t("oolshik:forceUpdateScreen.minimumVersion", { version: minVersion })

  const statusText = storeOpenFailed
    ? t("oolshik:forceUpdateScreen.storeOpenFailedStatus")
    : retrying
      ? t("oolshik:forceUpdateScreen.checkingStatus")
      : undefined

  return (
    <AppGateScreen
      tone="brand"
      icon="cellphone-arrow-down"
      eyebrowTx="oolshik:forceUpdateScreen.eyebrow"
      titleTx="oolshik:forceUpdateScreen.title"
      message={t("oolshik:forceUpdateScreen.message")}
      infoCardText={versionDetails}
      primaryAction={{
        tx: "oolshik:forceUpdateScreen.updateNow",
        onPress: handleUpdate,
      }}
      secondaryAction={{
        tx: retrying
          ? "oolshik:forceUpdateScreen.retrying"
          : "oolshik:forceUpdateScreen.alreadyUpdated",
        onPress: handleRetry,
        disabled: retrying,
      }}
      statusText={statusText}
      statusTone={storeOpenFailed ? "error" : "neutral"}
    />
  )
}
