import React, { useState } from "react"
import { View, ActivityIndicator } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import { useTranslation } from "react-i18next"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { OolshikApi } from "@/api"
import { storage } from "@/utils/storage"
import { useMMKVString } from "react-native-mmkv"

export default function ZoneGateScreen({ navigation }: any) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { t } = useTranslation()

  const [, setOnboardingComplete] = useMMKVString("onboarding.v1.completed", storage)

  const { coords } = useForegroundLocation({ autoRequest: false })

  const [checking, setChecking] = useState(false)
  const [joined, setJoined] = useState(false)
  const [joiningWaitlist, setJoiningWaitlist] = useState(false)
  const [nowAvailable, setNowAvailable] = useState(false)

  async function handleCheckAgain() {
    if (!coords || checking) return
    setChecking(true)
    try {
      const res = await OolshikApi.checkZone(coords.latitude, coords.longitude)
      if (res.ok && res.data?.eligible) {
        setNowAvailable(true)
        await OolshikApi.setOnboardingPhase("INTENT_SET")
        setOnboardingComplete("true")
        navigation.replace("OolshikHome")
      }
    } catch {
      // network error — stay on screen, user can retry
    } finally {
      setChecking(false)
    }
  }

  async function handleJoinWaitlist() {
    if (!coords || joined || joiningWaitlist) return
    setJoiningWaitlist(true)
    try {
      await OolshikApi.joinWaitlist(coords.latitude, coords.longitude)
      setJoined(true)
    } catch {
      // best-effort — silently fail
    } finally {
      setJoiningWaitlist(false)
    }
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]} contentContainerStyle={{ flex: 1 }}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          gap: spacing.lg,
        }}
      >
        <Text
          preset="heading"
          text={nowAvailable ? t("oolshik:zone.nowAvailable") : t("oolshik:zone.title")}
          style={{ textAlign: "center" }}
        />

        {!nowAvailable && (
          <Text
            text={t("oolshik:zone.body")}
            style={{ textAlign: "center", color: colors.textDim }}
          />
        )}

        {checking ? (
          <ActivityIndicator color={colors.tint} />
        ) : (
          <Button
            text={t("oolshik:zone.checkAgain")}
            onPress={handleCheckAgain}
            disabled={!coords || checking}
            style={{ alignSelf: "stretch" }}
          />
        )}

        {joined ? (
          <Text
            text={t("oolshik:zone.waitlistJoined")}
            size="sm"
            style={{ textAlign: "center", color: colors.palette.primary600 }}
          />
        ) : (
          <Button
            text={joiningWaitlist ? "…" : t("oolshik:zone.joinWaitlist")}
            onPress={handleJoinWaitlist}
            disabled={!coords || joined || joiningWaitlist}
            style={{ alignSelf: "stretch" }}
          />
        )}
      </View>
    </Screen>
  )
}
