import { FC } from "react"
import { View } from "react-native"
import * as WebBrowser from "expo-web-browser"
import { useTranslation } from "react-i18next"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { AppStackScreenProps } from "@/navigators/AppNavigator"
import { useAppTheme } from "@/theme/context"

import { AuthModeToggle } from "./login/AuthModeToggle"
import { GoogleLoginCard } from "./login/GoogleLoginCard"
import { LoginHero } from "./login/LoginHero"
import { PhoneOtpFlow } from "./login/PhoneOtpFlow"
import { $container, $surfaceCard } from "./login/loginStyles"
import { useLoginScreenController } from "./login/useLoginScreenController"

WebBrowser.maybeCompleteAuthSession()

interface LoginScreenProps extends AppStackScreenProps<"Login"> {}

export const LoginScreen: FC<LoginScreenProps> = () => {
  const controller = useLoginScreenController()
  const { themed, theme } = useAppTheme()
  const { colors } = theme
  const { t } = useTranslation()

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($container)}
    >
      <LoginHero />

      {controller.googleEnabled && controller.phoneOtpEnabled ? (
        <AuthModeToggle authMode={controller.authMode} onModeChange={controller.onModeChange} />
      ) : null}

      {!controller.googleEnabled && !controller.phoneOtpEnabled ? (
        <ScreenFallbackCard text={t("oolshik:login.authUnavailable")} textColor={colors.palette.angry500} />
      ) : controller.authMode === "google" && controller.googleEnabled ? (
        <GoogleLoginCard
          canUsePhoneNumberHint={controller.canUsePhoneNumberHint}
          googleConfigured={controller.googleConfigured}
          googlePhoneRequired={controller.googlePhoneRequired}
          googleRequestReady={controller.googleRequestReady}
          googleStatusMessage={controller.googleStatusMessage}
          googleStatusTone={controller.googleStatusTone}
          isGoogleLoading={controller.isGoogleLoading}
          onGooglePhoneBlur={controller.onGooglePhoneBlur}
          onGooglePress={controller.onGooglePress}
          onPhoneChange={controller.onPhoneChange}
          onPhoneFocus={controller.onPhoneFocus}
          onUseMyPhoneNumberPress={controller.onUseMyPhoneNumberPress}
          phone={controller.phone}
          phoneHintLoading={controller.phoneHintLoading}
          shouldShowGooglePhoneError={controller.shouldShowGooglePhoneError}
          googlePhoneError={controller.googlePhoneError}
        />
      ) : controller.phoneOtpEnabled ? (
        <PhoneOtpFlow
          activePhoneStep={controller.activePhoneStep}
          authEmail={controller.authEmail}
          canContinue={controller.canContinue}
          canUsePhoneNumberHint={controller.canUsePhoneNumberHint}
          displayName={controller.displayName}
          emailExpanded={controller.emailExpanded}
          isOtpSending={controller.isOtpSending}
          isOtpVerifying={controller.isOtpVerifying}
          loading={controller.loading}
          nameError={controller.nameError}
          onContinue={controller.onContinue}
          onDisplayNameChange={controller.onDisplayNameChange}
          onEmailToggle={controller.onEmailToggle}
          onOtpChange={controller.onOtpChange}
          onPhoneChange={controller.onPhoneChange}
          onPhoneFocus={controller.onPhoneFocus}
          onSetAuthEmail={controller.onSetAuthEmail}
          onUseMyPhoneNumberPress={controller.onUseMyPhoneNumberPress}
          onVerifyOtp={controller.onVerifyOtp}
          optionalEmailError={controller.optionalEmailError}
          otp={controller.otp}
          otpSent={controller.otpSent}
          otpVerified={controller.otpVerified}
          phone={controller.phone}
          phoneError={controller.phoneError}
          phoneHintLoading={controller.phoneHintLoading}
          phoneProgress={controller.phoneProgress}
          phoneShouldShowError={controller.phoneShouldShowError}
          resendIn={controller.resendIn}
          sendOtp={controller.sendOtp}
          triedContinue={controller.triedContinue}
        />
      ) : null}
    </Screen>
  )
}

function ScreenFallbackCard({ text, textColor }: { text: string; textColor: string }) {
  const { themed } = useAppTheme()

  return (
    <View style={themed($surfaceCard)}>
      <Text text={text} size="sm" style={{ color: textColor }} />
    </View>
  )
}
