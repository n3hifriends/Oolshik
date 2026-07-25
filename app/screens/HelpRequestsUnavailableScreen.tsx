import { useState } from "react"
import { Alert, Linking } from "react-native"
import { useTranslation } from "react-i18next"

import { AppGateScreen } from "@/components/AppGateScreen"
import { useAuth } from "@/context/AuthContext"
import {
  forceRefetchRemoteConfig,
  getRemoteFlag,
  getSupportContactConfig,
} from "@/services/remoteConfig"

export function HelpRequestsUnavailableScreen() {
  const { t } = useTranslation()
  const { logout } = useAuth()
  const [retrying, setRetrying] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false)

  const message =
    getRemoteFlag("feature_help_requests_disabled_message") ||
    t("oolshik:helpRequestsUnavailableScreen.defaultMessage")

  const { whatsapp, email } = getSupportContactConfig()

  const handleRetry = async () => {
    setRetrying(true)
    setCheckFailed(false)
    const succeeded = await forceRefetchRemoteConfig()
    setCheckFailed(!succeeded)
    setRetrying(false)
  }

  const handleContactSupport = async () => {
    if (whatsapp) {
      const phone = whatsapp.replace(/\D/g, "")
      const url = `whatsapp://send?phone=${encodeURIComponent(phone)}`
      try {
        const canOpen = await Linking.canOpenURL(url)
        if (!canOpen) throw new Error("WhatsApp not available")
        await Linking.openURL(url)
        return
      } catch {
        // Fall through to email if WhatsApp isn't installed/reachable.
      }
    }
    if (email) {
      try {
        await Linking.openURL(`mailto:${email}`)
        return
      } catch {
        // Fall through to the shared failure alert below.
      }
    }
    // Neither channel was reachable (or none configured a working one) — the
    // user's tap must not go silent, this is the one escape hatch on this screen.
    Alert.alert(
      t("oolshik:helpRequestsUnavailableScreen.contactSupportFailedTitle"),
      email
        ? t("oolshik:helpRequestsUnavailableScreen.contactSupportFailedBody", { email })
        : t("oolshik:helpRequestsUnavailableScreen.contactSupportFailedBodyNoEmail"),
    )
  }

  const statusText = checkFailed
    ? t("oolshik:helpRequestsUnavailableScreen.offlineStatus")
    : retrying
      ? t("oolshik:helpRequestsUnavailableScreen.checkingStatus")
      : undefined

  return (
    <AppGateScreen
      tone="info"
      icon="pause-circle-outline"
      eyebrowTx="oolshik:helpRequestsUnavailableScreen.eyebrow"
      titleTx="oolshik:helpRequestsUnavailableScreen.title"
      message={message}
      primaryAction={{
        tx: retrying
          ? "oolshik:helpRequestsUnavailableScreen.retrying"
          : "oolshik:helpRequestsUnavailableScreen.retry",
        onPress: handleRetry,
        disabled: retrying,
      }}
      secondaryAction={
        whatsapp || email
          ? {
              tx: "oolshik:helpRequestsUnavailableScreen.contactSupport",
              onPress: handleContactSupport,
            }
          : undefined
      }
      tertiaryAction={{
        tx: "oolshik:helpRequestsUnavailableScreen.logout",
        onPress: () => logout(),
      }}
      statusText={statusText}
      statusTone={checkFailed ? "error" : "neutral"}
    />
  )
}
