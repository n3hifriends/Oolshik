import { useState } from "react"
import { useTranslation } from "react-i18next"

import { AppGateScreen } from "@/components/AppGateScreen"
import { forceRefetchRemoteConfig, getMaintenanceConfig } from "@/services/remoteConfig"
import { formatDate } from "@/utils/formatDate"

export function MaintenanceScreen() {
  const { t } = useTranslation()
  const [retrying, setRetrying] = useState(false)
  const [checkFailed, setCheckFailed] = useState(false)

  const { message, expectedEndAt } = getMaintenanceConfig()

  const infoCardText = (() => {
    if (!expectedEndAt) return undefined
    try {
      return t("oolshik:maintenanceScreen.expectedBack", {
        time: formatDate(expectedEndAt, "MMM dd, h:mm a"),
      })
    } catch {
      // Malformed Remote Config timestamp — degrade to no ETA rather than crash the gate screen.
      return undefined
    }
  })()

  const handleRetry = async () => {
    setRetrying(true)
    setCheckFailed(false)
    const succeeded = await forceRefetchRemoteConfig()
    setCheckFailed(!succeeded)
    setRetrying(false)
  }

  const statusText = checkFailed
    ? t("oolshik:maintenanceScreen.offlineStatus")
    : retrying
      ? t("oolshik:maintenanceScreen.checkingStatus")
      : undefined

  return (
    <AppGateScreen
      tone="warning"
      icon="wrench-outline"
      eyebrowTx="oolshik:maintenanceScreen.eyebrow"
      titleTx="oolshik:maintenanceScreen.title"
      message={message || t("oolshik:maintenanceScreen.defaultMessage")}
      infoCardText={infoCardText}
      primaryAction={{
        tx: retrying ? "oolshik:maintenanceScreen.retrying" : "oolshik:maintenanceScreen.retry",
        onPress: handleRetry,
        disabled: retrying,
      }}
      statusText={statusText}
      statusTone={checkFailed ? "error" : "neutral"}
    />
  )
}
