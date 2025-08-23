import React, { memo } from "react"
import { Pressable, View, StyleSheet, Platform } from "react-native"
import { Text } from "@/components/Text"

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
  const S = styles(size, selected, disabled)

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
        style={S.label}
        // If your Text supports `color` or `preset` variants, you can swap S.label for those
      />
    </Pressable>
  )
})

function styles(size: "md" | "lg", selected: boolean, disabled: boolean) {
  const height = size === "lg" ? 44 : 36
  const padH = size === "lg" ? 14 : 12
  const dot = size === "lg" ? 12 : 10

  // neutral + selected palette (tweak to your theme if you expose tokens)
  const bg = selected ? "rgba(59,130,246,0.12)" : "#FFFFFF" // selected: soft primary tint
  const bd = selected ? "#BF360C" : "#E5E7EB" // border: primary vs. gray-200
  const fg = disabled ? "#9CA3AF" : selected ? "#1F2937" : "#374151" // text: dim if disabled
  const dotBg = selected ? "#FF6B2C" : "transparent"

  return StyleSheet.create({
    base: {
      height,
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
      borderColor: selected ? "transparent" : "#FF6B2C",
      backgroundColor: dotBg,
    },
    label: {
      color: fg,
      fontWeight: selected ? "600" : "500",
    },
  })
}
