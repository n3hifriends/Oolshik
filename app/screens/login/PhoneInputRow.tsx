import { memo, useState } from "react"
import { Pressable, TextInput, View } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

interface PhoneInputRowProps {
  value: string
  onChangeText: (v: string) => void
  onFocus?: () => void
  onBlur?: () => void
  placeholder?: string
  error?: string | null
  hint?: string
  infoLabel?: string
  onInfoPress?: () => void
  disabled?: boolean
  keyboardAppearance?: "default" | "light" | "dark"
}

export const PhoneInputRow = memo(function PhoneInputRow(props: PhoneInputRowProps) {
  const { theme } = useAppTheme()
  const { colors, typography, isDark, spacing } = theme
  const [focused, setFocused] = useState(false)

  const hasError = !!props.error
  const borderColor = hasError
    ? colors.palette.angry500
    : focused
      ? colors.palette.primary500
      : colors.palette.neutral300

  const bg = isDark ? colors.palette.neutral200 : colors.palette.neutral100

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          height: 52,
          borderRadius: 16,
          borderWidth: 1.5,
          borderColor,
          backgroundColor: bg,
          overflow: "hidden",
          ...(focused && !hasError
            ? {
                shadowColor: colors.palette.primary500,
                shadowOpacity: 0.12,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 1,
              }
            : {}),
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.xs,
            paddingHorizontal: spacing.sm,
          }}
        >
          <Text style={{ fontSize: 17, lineHeight: 22 }}>🇮🇳</Text>
          <Text
            text="+91"
            weight="bold"
            style={{ color: colors.text, fontSize: 15 }}
          />
        </View>

        <View
          style={{
            width: 1,
            height: 22,
            backgroundColor: focused && !hasError
              ? colors.palette.primary300
              : colors.palette.neutral300,
          }}
        />

        <TextInput
          value={props.value}
          onChangeText={props.onChangeText}
          onFocus={() => {
            setFocused(true)
            props.onFocus?.()
          }}
          onBlur={() => {
            setFocused(false)
            props.onBlur?.()
          }}
          placeholder={props.placeholder ?? "10-digit mobile number"}
          placeholderTextColor={colors.textDim}
          keyboardType="phone-pad"
          maxLength={10}
          editable={!props.disabled}
          keyboardAppearance={props.keyboardAppearance}
          returnKeyType="done"
          style={{
            flex: 1,
            height: 52,
            paddingHorizontal: spacing.sm,
            fontFamily: typography.primary.medium,
            fontSize: 16,
            color: colors.text,
          }}
        />
      </View>

      <View style={{ minHeight: 18, marginTop: spacing.xxs, marginLeft: 4 }}>
        {hasError ? (
          <Text
            text={props.error!}
            size="xs"
            style={{ color: colors.palette.angry500 }}
          />
        ) : props.hint ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xxs }}>
            <Text text={props.hint} size="xs" style={{ color: colors.textDim, flexShrink: 1 }} />
            {props.onInfoPress ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={props.infoLabel ?? props.hint}
                hitSlop={14}
                onPress={props.onInfoPress}
              >
                <MaterialCommunityIcons
                  name="information-outline"
                  size={16}
                  color={colors.textDim}
                />
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  )
})
