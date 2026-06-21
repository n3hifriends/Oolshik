import React from "react"
import { Pressable, View } from "react-native"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

export const Pill: React.FC<{
  label: string
  active?: boolean
  onPress?: () => void
  dotColor?: string
}> = ({ label, active, onPress, dotColor = "#FF6B2C" }) => {
  const { theme } = useAppTheme()
  const activeBg = theme.isDark ? theme.colors.tint : "#111827"
  const inactiveBg = theme.isDark ? theme.colors.separator : "#F2F4F7"
  const activeText = theme.isDark ? theme.colors.background : "#fff"
  const inactiveText = theme.colors.text

  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 7,
        paddingVertical: 4,
        borderRadius: 499,
        backgroundColor: active ? activeBg : inactiveBg,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: active ? activeText : dotColor,
          opacity: active ? 1 : 0.8,
        }}
      />
      <Text
        size="xxs"
        style={{ color: active ? activeText : inactiveText, fontWeight: "600" }}
        text={label}
      />
    </Pressable>
  )
}
