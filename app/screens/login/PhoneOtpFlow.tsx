import { memo } from "react"
import { Pressable, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"

import { PhoneHintAction } from "./PhoneHintAction"
import { OtpBoxes } from "./OtpBoxes"
import {
  $cardHeader,
  $ccBadge,
  $disclosure,
  $footerCard,
  $inputWrapperDense,
  $progressEyebrow,
  $progressFill,
  $progressHeader,
  $progressPill,
  $progressTrack,
  $stepBadge,
  $stepCard,
  $stepCardActive,
  $supportingText,
  $surfaceCard,
} from "./loginStyles"

interface PhoneOtpFlowProps {
  activePhoneStep: 1 | 2 | 3
  authEmail?: string
  canContinue: boolean
  canUsePhoneNumberHint: boolean
  displayName: string
  emailExpanded: boolean
  isOtpSending: boolean
  isOtpVerifying: boolean
  loading: "send" | "verify" | "google" | null
  nameError: string
  onContinue: () => void
  onDisplayNameChange: (value: string) => void
  onEmailToggle: () => void
  onOtpChange: (value: string) => void
  onPhoneChange: (value: string) => void
  onPhoneFocus: () => void
  onSetAuthEmail: (value?: string) => void
  onUseMyPhoneNumberPress: () => void
  onVerifyOtp: () => void
  optionalEmailError: string
  otp: string
  otpSent: boolean
  otpVerified: boolean
  phone: string
  phoneError: string
  phoneHintLoading: boolean
  phoneProgress: number
  phoneShouldShowError: boolean
  resendIn: number
  sendOtp: () => void
  triedContinue: boolean
}

export const PhoneOtpFlow = memo(function PhoneOtpFlow(props: PhoneOtpFlowProps) {
  const { t } = useTranslation()
  const { themed, theme } = useAppTheme()
  const { spacing, colors, isDark } = theme

  return (
    <>
      <View style={themed($surfaceCard)}>
        <View style={themed($progressHeader)}>
          <View style={{ flex: 1 }}>
            <Text
              text={t("oolshik:login.stepCounter", { current: props.activePhoneStep, total: 3 })}
              size="xs"
              weight="semiBold"
              style={themed($progressEyebrow)}
            />
            <Text
              text={
                props.activePhoneStep === 1
                  ? t("oolshik:login.stepVerifyMobile")
                  : props.activePhoneStep === 2
                    ? t("oolshik:login.stepEnterOtp")
                    : t("oolshik:login.stepYourName")
              }
              weight="bold"
            />
          </View>
          <View style={themed($progressPill)}>
            <Text
              text={`${props.activePhoneStep}/3`}
              size="xxs"
              weight="bold"
              style={{ color: colors.palette.neutral100 }}
            />
          </View>
        </View>

        <View style={themed($progressTrack)}>
          <View
            style={[themed($progressFill), { width: `${Math.max(props.phoneProgress * 100, 20)}%` }]}
          />
        </View>

        <Text text={t("oolshik:login.privacyNote")} size="xs" style={themed($supportingText)} />
      </View>

      <View style={themed([$stepCard, props.activePhoneStep === 1 && $stepCardActive])}>
        <View style={themed($cardHeader)}>
          <View style={themed($stepBadge)}>
            <Text
              text="1"
              weight="bold"
              style={{ color: isDark ? colors.palette.neutral100 : colors.palette.neutral900 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text text={t("oolshik:login.stepVerifyMobile")} weight="bold" />
            <Text text={t("oolshik:login.phoneHint")} size="xs" style={themed($supportingText)} />
          </View>
          {props.otpVerified ? (
            <Text text="✓" style={{ marginLeft: "auto", color: colors.palette.success500 }} />
          ) : null}
        </View>

        <PhoneHintAction
          visible={props.canUsePhoneNumberHint}
          loading={props.phoneHintLoading}
          onPress={props.onUseMyPhoneNumberPress}
          disabled={props.phoneHintLoading || props.loading !== null}
        />

        <View style={{ flexDirection: "row", gap: spacing.sm, alignItems: "center" }}>
          <View style={themed($ccBadge)}>
            <Text text="+91" weight="bold" style={{ color: colors.palette.neutral800 }} />
          </View>
          <View style={{ flex: 1 }}>
            <TextField
              value={props.phone}
              onChangeText={props.onPhoneChange}
              onFocus={props.onPhoneFocus}
              containerStyle={{ marginBottom: 0 }}
              keyboardType="phone-pad"
              placeholder={t("oolshik:login.phonePlaceholder")}
              status={props.phoneShouldShowError ? "error" : undefined}
              maxLength={10}
              editable={!props.otpVerified}
              inputWrapperStyle={themed($inputWrapperDense)}
              keyboardAppearance={isDark ? "dark" : "light"}
              style={{ height: 50, paddingVertical: 0 }}
            />
          </View>
        </View>

        {props.phoneShouldShowError ? (
          <Text
            text={
              props.phoneError === "phone_required"
                ? t("oolshik:login.phoneRequired")
                : t("oolshik:login.phoneDigits")
            }
            size="xs"
            style={{ color: colors.palette.angry500, marginTop: spacing.xs }}
          />
        ) : null}

        <Text
          text={t("oolshik:login.phonePaymentBindingNote")}
          size="xs"
          style={[themed($supportingText), { marginTop: spacing.xs }]}
        />

        <Button
          text={
            props.otpSent
              ? props.resendIn > 0
                ? t("oolshik:login.resendIn", { seconds: props.resendIn })
                : props.isOtpSending
                  ? t("oolshik:login.sending")
                  : t("oolshik:login.resendOtp")
              : props.isOtpSending
                ? t("oolshik:login.sending")
                : t("oolshik:login.sendOtp")
          }
          preset="filled"
          onPress={props.sendOtp}
          disabled={!!props.phoneError || props.isOtpSending || (props.otpSent && props.resendIn > 0)}
          style={{ marginTop: spacing.md }}
        />
      </View>

      <View style={themed([$stepCard, props.activePhoneStep === 2 && $stepCardActive])}>
        <View style={themed($cardHeader)}>
          <View style={themed($stepBadge)}>
            <Text
              text="2"
              weight="bold"
              style={{ color: isDark ? colors.palette.neutral100 : colors.palette.neutral900 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text text={t("oolshik:login.stepEnterOtp")} weight="bold" />
            <Text text={t("oolshik:login.otpHint")} size="xs" style={themed($supportingText)} />
          </View>
          {props.otpVerified ? (
            <Text
              text={`✓ ${t("oolshik:login.verified")}`}
              style={{ marginLeft: "auto", color: colors.palette.success500 }}
            />
          ) : null}
        </View>

        <OtpBoxes value={props.otp} onChange={props.onOtpChange} editable={props.otpSent && !props.otpVerified} />

        {!props.otpSent ? (
          <Text text={t("oolshik:login.sendOtpFirst")} size="xs" style={themed($supportingText)} />
        ) : null}

        {!props.otpVerified ? (
          <Button
            text={props.isOtpVerifying ? t("oolshik:login.verifying") : t("oolshik:login.verify")}
            preset="filled"
            onPress={props.onVerifyOtp}
            disabled={!props.otpSent || props.otp.length !== 6 || props.isOtpVerifying}
            style={{ marginTop: spacing.md }}
          />
        ) : null}
      </View>

      <View style={themed([$stepCard, props.activePhoneStep === 3 && $stepCardActive])}>
        <View style={themed($cardHeader)}>
          <View style={themed($stepBadge)}>
            <Text
              text="3"
              weight="bold"
              style={{ color: isDark ? colors.palette.neutral100 : colors.palette.neutral900 }}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text text={t("oolshik:login.stepYourName")} weight="bold" />
            <Text text={t("oolshik:login.nameHint")} size="xs" style={themed($supportingText)} />
          </View>
          {props.displayName.trim().length > 0 ? (
            <Text text="✓" style={{ marginLeft: "auto", color: colors.palette.success500 }} />
          ) : null}
        </View>
        <TextField
          value={props.displayName}
          onChangeText={props.onDisplayNameChange}
          placeholder={t("oolshik:login.stepYourName")}
          autoCapitalize="words"
          keyboardAppearance={isDark ? "dark" : "light"}
          status={props.triedContinue && props.nameError ? "error" : undefined}
          helper={props.triedContinue && props.nameError ? t("oolshik:login.nameRequired") : undefined}
        />
      </View>

      <View style={themed($stepCard)}>
        <Pressable onPress={props.onEmailToggle} style={themed($cardHeader)}>
          <View style={{ flex: 1 }}>
            <Text text={t("oolshik:login.email")} weight="bold" />
            <Text text={t("oolshik:login.emailHint")} size="xs" style={themed($supportingText)} />
          </View>
          <Text text={props.emailExpanded ? "−" : "+"} style={themed($disclosure)} />
        </Pressable>
        {props.emailExpanded ? (
          <TextField
            value={props.authEmail}
            onChangeText={props.onSetAuthEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            keyboardAppearance={isDark ? "dark" : "light"}
            placeholder={t("oolshik:login.emailPlaceholder")}
            helper={props.optionalEmailError || undefined}
            status={props.optionalEmailError ? "error" : undefined}
          />
        ) : null}
      </View>

      <View style={themed($footerCard)}>
        <Button
          text={t("oolshik:login.continue")}
          preset="filled"
          onPress={props.onContinue}
          disabled={!props.canContinue}
        />
      </View>
    </>
  )
})
