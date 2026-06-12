import { memo } from "react"
import { Pressable, StyleSheet, View } from "react-native"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { SupportedLocaleTag } from "@/i18n/locale"

// Labels are intentionally hardcoded in their own native script — a user switching
// TO Marathi must be able to read "मराठी" even when the UI is currently in English.
const LANGUAGE_OPTIONS: { tag: SupportedLocaleTag; label: string }[] = [
  { tag: "en-IN", label: "English" },
  { tag: "mr-IN", label: "मराठी" },
]

interface LanguageToggleProps {
  currentLanguage: SupportedLocaleTag
  onLanguageChange: (tag: SupportedLocaleTag) => void
}

export const LanguageToggle = memo(function LanguageToggle({
  currentLanguage,
  onLanguageChange,
}: LanguageToggleProps) {
  const { theme } = useAppTheme()
  const { colors } = theme

  return (
    <View style={styles.row}>
      {LANGUAGE_OPTIONS.map(({ tag, label }) => {
        const active = currentLanguage === tag
        return (
          <Pressable
            key={tag}
            onPress={() => onLanguageChange(tag)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={label}
            hitSlop={8}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: active ? colors.palette.primary500 : "transparent",
                borderColor: active ? colors.palette.primary500 : colors.palette.neutral400,
              },
              pressed && styles.chipPressed,
            ]}
          >
            <Text
              text={label}
              size="xxs"
              weight={active ? "semiBold" : "medium"}
              style={{ color: active ? colors.palette.neutral100 : colors.textDim }}
            />
          </Pressable>
        )
      })}
    </View>
  )
})

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipPressed: {
    opacity: 0.75,
  },
})
