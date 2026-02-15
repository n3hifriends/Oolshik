import React from "react"
import { Pressable } from "react-native"
import { Text } from "@/components/Text"

type LogoutButtonProps = {
  onPress: () => void
  accessibilityLabel: string
  backgroundColor: string
}

export function LogoutButton({ onPress, accessibilityLabel, backgroundColor }: LogoutButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => ({
        position: "absolute",
        top: 8,
        right: 12,
        width: 30,
        height: 30,
        borderRadius: 22,
        backgroundColor,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        shadowColor: "#000",
        shadowOpacity: 0.14,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 5,
        transform: [{ scale: pressed ? 0.98 : 1 }],
      })}
      hitSlop={8}
    >
      <Text text="⎋" style={{ color: "#fff", fontSize: 18, lineHeight: 18 }} />
    </Pressable>
  )
}
