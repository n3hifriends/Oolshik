import React, { useState } from "react"
import { View } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useTranslation } from "react-i18next"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"

export default function OnboardingConsentScreen({ navigation }: any) {
  const { i18n } = useTranslation()
  const [accepted, setAccepted] = useState(false)
  const { granted } = useForegroundLocation()

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <Text preset="heading" tx="oolshik:consentTitle" />
      <Text tx="oolshik:locationPermissionMsg" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button tx="oolshik:marathi" onPress={() => i18n.changeLanguage("mr")} />
        <Button tx="oolshik:english" onPress={() => i18n.changeLanguage("en")} />
      </View>
      <Button tx="oolshik:consentAgree" onPress={() => setAccepted(true)} />
      {accepted && granted && (
        <Button tx="oolshik:home" onPress={() => navigation.replace("OolshikHome")} />
      )}
    </Screen>
  )
}
