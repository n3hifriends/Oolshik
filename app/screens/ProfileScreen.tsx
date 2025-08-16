import React from "react"
import { View } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useTranslation } from "react-i18next"

export default function ProfileScreen() {
  const { i18n } = useTranslation()
  return (
    <Screen preset="fixed" safeAreaEdges={["top","bottom"]} contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text preset="heading" text="Profile" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button text="मराठी" onPress={() => i18n.changeLanguage("mr")} />
        <Button text="English" onPress={() => i18n.changeLanguage("en")} />
      </View>
    </Screen>
  )
}
