import React from "react"
import { Pressable, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Text } from "@/components/Text"
import type { TxKeyPath } from "@/i18n"
import { useAppTheme } from "@/theme/context"

export type ViewMode = "forYou" | "mine"

export const Segmented: React.FC<{ value: ViewMode; onChange: (v: ViewMode) => void }> = ({
  value,
  onChange,
}) => {
  const { t } = useTranslation()
  const { theme } = useAppTheme()
  const { colors, spacing, isDark } = theme
  const tabs: { key: ViewMode; tx: TxKeyPath; a11y: string }[] = [
    { key: "forYou", tx: "oolshik:tabForYou", a11y: t("oolshik:tabForYou") },
    { key: "mine", tx: "oolshik:tabMyRequests", a11y: t("oolshik:tabMyRequests") },
  ]
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.palette.neutral200,
        borderRadius: spacing.sm,
        padding: spacing.xxxs,
        gap: spacing.xxxs,
        marginTop: spacing.xxxs,
        borderWidth: 1,
        borderColor: colors.palette.neutral300,
      }}
    >
      {tabs.map((t) => {
        const active = value === t.key
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.a11y}
            style={({ pressed }) => [
              {
                flex: 1,
                minHeight: 36,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                borderRadius: spacing.sm,
                backgroundColor: active ? colors.palette.neutral100 : "transparent",
                borderWidth: active ? 1 : 0,
                borderColor: active ? colors.palette.primary200 : "transparent",
              },
              active &&
                !isDark && {
                  shadowColor: "#000",
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 2,
                },
              pressed &&
                !active && {
                  backgroundColor: colors.palette.neutral300,
                },
            ]}
          >
            <Text
              tx={t.tx}
              size="xs"
              weight={active ? "semiBold" : "medium"}
              style={{ color: active ? colors.text : colors.textDim }}
            />
          </Pressable>
        )
      })}
    </View>
  )
}
