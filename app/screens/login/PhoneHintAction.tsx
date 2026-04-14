import { memo } from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

import {
  $phoneHintBlock,
  $phoneHintChip,
  $phoneHintChipDisabled,
  $phoneHintChipLabel,
  $phoneHintChipPressed,
  $phoneHintChipRow,
  $phoneHintIconBadge,
  $phoneHintSubcopy,
} from "./loginStyles"

interface PhoneHintActionProps {
  disabled: boolean
  loading: boolean
  onPress: () => void
  visible: boolean
}

export const PhoneHintAction = memo(function PhoneHintAction({
  disabled,
  loading,
  onPress,
  visible,
}: PhoneHintActionProps) {
  const { t } = useTranslation()
  const { themed, theme } = useAppTheme()
  const { colors } = theme

  if (!visible) return null

  return (
    <View style={themed($phoneHintBlock)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("oolshik:login.useMyPhoneNumber")}
        accessibilityHint={t("oolshik:login.phoneHintActionHelper")}
        accessibilityState={{ disabled, busy: loading }}
        android_ripple={{ color: colors.palette.overlay20 }}
        disabled={disabled || loading}
        onPress={onPress}
        style={({ pressed }) => [
          themed($phoneHintChip),
          pressed && themed($phoneHintChipPressed),
          (disabled || loading) && themed($phoneHintChipDisabled),
        ]}
      >
        <View style={themed($phoneHintChipRow)}>
          <View style={themed($phoneHintIconBadge)}>
            {loading ? (
              <ActivityIndicator color={colors.palette.primary500} size="small" />
            ) : (
              <MaterialCommunityIcons
                name="cellphone-check"
                size={18}
                color={colors.palette.primary500}
              />
            )}
          </View>

          <Text
            text={t("oolshik:login.useMyPhoneNumber")}
            weight="semiBold"
            size="xs"
            style={themed($phoneHintChipLabel)}
          />
        </View>
      </Pressable>

      <Text
        text={t("oolshik:login.phoneHintActionHelper")}
        size="xxs"
        style={themed($phoneHintSubcopy)}
      />
    </View>
  )
})
