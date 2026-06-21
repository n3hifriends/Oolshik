import { useState } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import { forceRefetchRemoteConfig, getRemoteFlag } from "@/services/remoteConfig"
import { useAuth } from "@/context/AuthContext"

export function HelpRequestsUnavailableScreen() {
  const { t } = useTranslation()
  const { theme: { colors } } = useAppTheme()
  const { logout } = useAuth()
  const [retrying, setRetrying] = useState(false)

  const message =
    getRemoteFlag("feature_help_requests_disabled_message") ||
    t("oolshik:helpRequestsUnavailableScreen.defaultMessage")

  const handleRetry = async () => {
    setRetrying(true)
    await forceRefetchRemoteConfig()
    setRetrying(false)
  }

  return (
    <Screen
      preset="fixed"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={styles.container}
    >
      <View style={styles.content}>
        <Text
          preset="heading"
          tx="oolshik:helpRequestsUnavailableScreen.title"
          style={[styles.title, { color: colors.text }]}
        />
        <Text style={[styles.message, { color: colors.textDim }]}>{message}</Text>
        <Button
          tx={
            retrying
              ? "oolshik:helpRequestsUnavailableScreen.retrying"
              : "oolshik:helpRequestsUnavailableScreen.retry"
          }
          onPress={handleRetry}
          disabled={retrying}
          style={styles.button}
        />
        <Button
          tx="oolshik:helpRequestsUnavailableScreen.logout"
          onPress={logout}
          preset="default"
          style={[styles.button, styles.logoutButton]}
        />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    marginBottom: 16,
    textAlign: "center",
  },
  message: {
    textAlign: "center",
    marginBottom: 40,
    lineHeight: 22,
  },
  button: {
    minWidth: 160,
  },
  logoutButton: {
    marginTop: 12,
  },
})
