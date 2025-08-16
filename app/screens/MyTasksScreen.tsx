import React from "react"
import { View } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"

export default function MyTasksScreen() {
  return (
    <Screen preset="fixed" safeAreaEdges={["top","bottom"]} contentContainerStyle={{ padding: 16 }}>
      <Text preset="heading" text="My Tasks" />
      <View style={{ height: 12 }} />
    </Screen>
  )
}
