import React from "react"
import { Pressable, View } from "react-native"
import { Text } from "@/components/Text"

export const Pill: React.FC<{
  label: string
  active?: boolean
  onPress?: () => void
  dotColor?: string
}> = ({ label, active, onPress, dotColor = "#FF6B2C" }) => (
  <Pressable
    onPress={onPress}
    style={{
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: 499,
      backgroundColor: active ? "#111827" : "#F2F4F7",
    }}
  >
    <View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: active ? "#fff" : dotColor,
        opacity: active ? 1 : 0.8,
      }}
    />
    <Text
      size="xxs"
      style={{ color: active ? "#fff" : "#111827", fontWeight: "600" }}
      text={label}
    />
  </Pressable>
)
