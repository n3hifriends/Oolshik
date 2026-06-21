import { useState } from "react"
import { Linking, Platform, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"
import * as Application from "expo-application"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import { forceRefetchRemoteConfig, getVersionConfig } from "@/services/remoteConfig"

// Hardcoded build-time constants — never sourced from Remote Config.
// A broken Remote Config URL on this screen would trap users with no escape.
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.oolshik.aan"
const APP_STORE_URL = "https://apps.apple.com/app/id6744416843"

export function ForceUpdateScreen() {
  const { t } = useTranslation()
  const { theme: { colors } } = useAppTheme()
  const [retrying, setRetrying] = useState(false)

  const currentVersion = Application.nativeApplicationVersion ?? "—"
  const { minAndroid, minIos } = getVersionConfig()
  const minVersion = Platform.OS === "android" ? minAndroid : minIos
  const storeUrl = Platform.OS === "android" ? PLAY_STORE_URL : APP_STORE_URL

  const handleUpdate = () => {
    Linking.openURL(storeUrl).catch(() => {})
  }

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
          tx="oolshik:forceUpdateScreen.title"
          style={[styles.title, { color: colors.text }]}
        />
        <Text
          tx="oolshik:forceUpdateScreen.message"
          style={[styles.message, { color: colors.textDim }]}
        />
        <Text
          style={[styles.versionLine, { color: colors.textDim }]}
          text={t("oolshik:forceUpdateScreen.currentVersion", { version: currentVersion })}
        />
        <Text
          style={[styles.versionLine, { color: colors.textDim }]}
          text={t("oolshik:forceUpdateScreen.minimumVersion", { version: minVersion })}
        />
        <Button
          tx="oolshik:forceUpdateScreen.updateNow"
          onPress={handleUpdate}
          style={styles.primaryButton}
        />
        <Button
          tx={retrying ? "oolshik:forceUpdateScreen.retrying" : "oolshik:forceUpdateScreen.alreadyUpdated"}
          onPress={handleRetry}
          disabled={retrying}
          preset="default"
          style={styles.secondaryButton}
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
    marginBottom: 12,
    lineHeight: 22,
  },
  versionLine: {
    textAlign: "center",
    marginBottom: 4,
  },
  primaryButton: {
    minWidth: 200,
    marginTop: 32,
    marginBottom: 12,
  },
  secondaryButton: {
    minWidth: 200,
  },
})
