import React from "react"
import { View } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"

export default function TaskDetailScreen() {
  return (
    <Screen preset="fixed" safeAreaEdges={["top","bottom"]} contentContainerStyle={{ padding: 16 }}>
      <Text preset="heading" text="Task Detail" />
      <View style={{ height: 12 }} />
      <Button text="Accept" onPress={() => {}} />
    </Screen>
  )
}
