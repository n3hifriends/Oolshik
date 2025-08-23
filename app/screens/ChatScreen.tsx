import React from "react"
import { View } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"

export default function ChatScreen() {
  return (
    <Screen preset="fixed" safeAreaEdges={["top","bottom"]} contentContainerStyle={{ padding: 16 }}>
      <Text preset="heading" text="Chat (MVP text-only)" />
      <View style={{ height: 12 }} />
    </Screen>
  )
}
