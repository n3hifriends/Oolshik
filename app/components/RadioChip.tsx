import React, { memo } from "react"
import { Pressable, View, StyleSheet, Platform } from "react-native"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

export type RadioChipValue = string | number

type RadioChipProps = {
  label: string
  value: RadioChipValue
  selected?: boolean
  disabled?: boolean
  onChange?: (value: RadioChipValue) => void
  size?: "md" | "lg"
}

export const RadioChip = memo(function RadioChip({
  label,
  value,
  selected = false,
  disabled = false,
  onChange,
  size = "md",
}: RadioChipProps) {
  const { theme } = useAppTheme()
  const S = styles(size, selected, disabled, theme)

  return (
    <Pressable
      onPress={() => !disabled && onChange?.(value)}
      style={({ pressed }) => [S.base, pressed && S.pressed]}
      role="radio"
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      hitSlop={10}
      android_ripple={disabled ? undefined : { borderless: true }}
    >
      <View style={S.dot} />
      <Text
        text={label}
        preset="default"
        numberOfLines={1}
        maxFontSizeMultiplier={1.1}
        style={S.label}
      />
    </Pressable>
  )
})

function styles(size: "md" | "lg", selected: boolean, disabled: boolean, theme: any) {
  const height = size === "lg" ? 44 : 36
  const padH = size === "lg" ? 14 : 12
  const dot = size === "lg" ? 12 : 10

  const bg = selected
    ? theme.isDark ? "rgba(59,130,246,0.20)" : "rgba(59,130,246,0.12)"
    : theme.colors.surface
  const bd = selected ? "#BF360C" : theme.colors.border
  const fg = disabled ? theme.colors.textDim : theme.colors.text

  return StyleSheet.create({
    base: {
      minHeight: height,
      paddingHorizontal: padH,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: bd,
      backgroundColor: bg,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      opacity: disabled ? 0.6 : 1,
      ...(Platform.OS === "ios"
        ? {
            shadowColor: "#000",
            shadowOpacity: selected ? 0.08 : 0.04,
            shadowRadius: 6,
            shadowOffset: { width: 0, height: 3 },
          }
        : { elevation: selected ? 1 : 0 }),
    },
    pressed: {
      transform: [{ scale: 0.98 }],
    },
    dot: {
      width: dot,
      height: dot,
      borderRadius: 999,
      borderWidth: selected ? 0 : 1,
      borderColor: selected ? "transparent" : theme.colors.tint,
      backgroundColor: selected ? theme.colors.tint : "transparent",
    },
    label: {
      color: fg,
      fontWeight: selected ? "600" : "500",
      flexShrink: 1,
    },
  })
}
