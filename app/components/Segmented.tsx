import { memo } from "react"
import { Pressable, type StyleProp, type TextStyle, type ViewStyle, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Text } from "@/components/Text"
import type { TxKeyPath } from "@/i18n"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export type ViewMode = "forYou" | "mine"

type SegmentedProps = {
  value: ViewMode
  onChange: (value: ViewMode) => void
}

type SegmentedTab = {
  key: ViewMode
  tx: TxKeyPath
}

const TABS: SegmentedTab[] = [
  { key: "forYou", tx: "oolshik:tabForYou" },
  { key: "mine", tx: "oolshik:tabMyRequests" },
]

export const Segmented = memo(function Segmented({ value, onChange }: SegmentedProps) {
  const { t } = useTranslation()
  const { theme, themed } = useAppTheme()

  const getTabStyle = ({
    active,
    pressed,
  }: {
    active: boolean
    pressed: boolean
  }): StyleProp<ViewStyle> => {
    return [
      themed($tabBase),
      themed(active ? $tabActive : $tabInactive),
      active && !theme.isDark && themed($tabActiveShadow),
      pressed && themed(active ? $tabPressedActive : $tabPressedInactive),
    ]
  }

  const getLabelStyle = ({
    active,
    pressed,
  }: {
    active: boolean
    pressed: boolean
  }): StyleProp<TextStyle> => {
    return [
      themed($labelBase),
      themed(active ? $labelActive : $labelInactive),
      pressed && themed($labelPressed),
    ]
  }

  return (
    <View style={themed($container)}>
      {TABS.map((tab) => {
        const active = value === tab.key
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t(tab.tx)}
            hitSlop={6}
            android_ripple={themed($ripple)}
            style={({ pressed }) => getTabStyle({ active, pressed })}
          >
            {({ pressed }) => (
              <>
                <Text
                  tx={tab.tx}
                  size="xs"
                  weight={active ? "semiBold" : "medium"}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={getLabelStyle({ active, pressed })}
                />

                <View style={themed(active ? $activeRail : $inactiveRail)} />
              </>
            )}
          </Pressable>
        )
      })}
    </View>
  )
})

const $container: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  flexDirection: "row",
  backgroundColor: colors.palette.neutral100,
  borderRadius: 14,
  padding: spacing.xxxs,
  gap: spacing.xxxs,
  marginTop: spacing.xxxs,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
})

const $tabBase: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  minHeight: 40,
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: spacing.xxxs,
  paddingHorizontal: spacing.sm,
  borderRadius: 10,
  overflow: "hidden",
})

const $tabActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.primary100,
  borderWidth: 1,
  borderColor: colors.palette.primary200,
})

const $tabInactive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.neutral100,
  borderWidth: 1,
  borderColor: colors.palette.neutral200,
})

const $tabActiveShadow: ThemedStyle<ViewStyle> = ({ colors }) => ({
  shadowColor: colors.palette.overlay50,
  shadowOpacity: 0.12,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
})

const $tabPressedInactive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.neutral200,
  transform: [{ scale: 0.99 }],
})

const $tabPressedActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.primary200,
  transform: [{ scale: 0.99 }],
})

const $labelBase: ThemedStyle<TextStyle> = () => ({
  textAlign: "center",
  flexShrink: 1,
})

const $labelActive: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.primary600,
})

const $labelInactive: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.neutral600,
})

const $labelPressed: ThemedStyle<TextStyle> = () => ({
  opacity: 0.95,
})

const $activeRail: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  position: "absolute",
  left: spacing.sm,
  right: spacing.sm,
  bottom: 4,
  height: 2,
  borderRadius: 2,
  backgroundColor: colors.palette.primary500,
})

const $inactiveRail: ThemedStyle<ViewStyle> = () => ({
  display: "none",
})

const $ripple: ThemedStyle<{ color: string }> = ({ colors }) => ({
  color: colors.palette.primary100,
})
