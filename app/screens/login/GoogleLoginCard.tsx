import { memo } from "react"
import { View } from "react-native"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

import { PhoneHintAction } from "./PhoneHintAction"
import { PhoneInputRow } from "./PhoneInputRow"
import {
  $stepBadge,
  $supportingText,
  $surfaceCard,
  $surfaceHeader,
} from "./loginStyles"

interface GoogleLoginCardProps {
  canUsePhoneNumberHint: boolean
  googleConfigured: boolean
  googlePhoneRequired: boolean
  googleRequestReady: boolean
  googleStatusMessage: string | null
  googleStatusTone: "error" | "success"
  isGoogleLoading: boolean
  onGooglePhoneBlur: () => void
  onGooglePress: () => void
  onPhoneChange: (value: string) => void
  onPhoneFocus: () => void
  onUseMyPhoneNumberPress: () => void
  phone: string
  phoneHintLoading: boolean
  shouldShowGooglePhoneError: boolean
  googlePhoneError: string
}

export const GoogleLoginCard = memo(function GoogleLoginCard(props: GoogleLoginCardProps) {
  const { t } = useTranslation()
  const { themed, theme } = useAppTheme()
  const { spacing, colors, isDark } = theme
  const phoneError = props.shouldShowGooglePhoneError
    ? props.googlePhoneError === "phone_required"
      ? t("oolshik:login.phoneRequired")
      : props.googlePhoneError === "phone_prefix"
        ? t("oolshik:login.phonePrefix")
        : t("oolshik:login.phoneDigits")
    : null

  return (
    <View style={themed($surfaceCard)}>
      <View style={themed($surfaceHeader)}>
        <View style={themed($stepBadge)}>
          <Text
            text="G"
            weight="bold"
            maxFontSizeMultiplier={1}
            style={{ color: isDark ? colors.palette.neutral100 : colors.palette.neutral900 }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text text={t("oolshik:login.googleHeading")} weight="bold" />
        </View>
      </View>

      {props.googlePhoneRequired ? (
        <>
          <PhoneHintAction
            visible={props.canUsePhoneNumberHint}
            loading={props.phoneHintLoading}
            onPress={props.onUseMyPhoneNumberPress}
            disabled={props.phoneHintLoading || props.isGoogleLoading}
          />

          <View style={{ marginTop: spacing.md }}>
            <PhoneInputRow
              value={props.phone}
              onChangeText={props.onPhoneChange}
              onBlur={props.onGooglePhoneBlur}
              onFocus={props.onPhoneFocus}
              placeholder={t("oolshik:login.phonePlaceholder")}
              error={phoneError}
              hint={t("oolshik:login.phonePaymentBindingNote")}
              disabled={props.isGoogleLoading}
              keyboardAppearance={isDark ? "dark" : "light"}
            />
          </View>
        </>
      ) : null}

      {!props.googleConfigured ? (
        <Text
          text={t("oolshik:login.googleUnavailable")}
          size="xs"
          style={{ color: colors.palette.angry500, marginTop: spacing.sm }}
        />
      ) : null}

      {props.googleStatusMessage ? (
        <Text
          text={props.googleStatusMessage}
          size="xs"
          style={{
            marginTop: spacing.sm,
            color:
              props.googleStatusTone === "success"
                ? colors.palette.success500
                : colors.palette.angry500,
          }}
        />
      ) : null}

      <Button
        text={
          props.isGoogleLoading
            ? t("oolshik:login.googleLoading")
            : t("oolshik:login.continueWithGoogle")
        }
        preset="filled"
        onPress={props.onGooglePress}
        disabled={
          !props.googleRequestReady ||
          !props.googleConfigured ||
          props.isGoogleLoading ||
          !!props.googlePhoneError
        }
        style={{ marginTop: spacing.lg }}
      />
    </View>
  )
})
