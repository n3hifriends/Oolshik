import React from "react"
import { View } from "react-native"
import { useTranslation } from "react-i18next"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"

export default function MyTasksScreen() {
  const { t } = useTranslation()
  return (
    <Screen preset="fixed" safeAreaEdges={["top","bottom"]} contentContainerStyle={{ padding: 16 }}>
      <Text preset="heading" text={t("oolshik:myTasksScreen.heading")} />
      <View style={{ height: 12 }} />
    </Screen>
  )
}
