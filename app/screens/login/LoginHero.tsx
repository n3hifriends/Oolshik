import { memo } from "react"
import { View } from "react-native"
import { useTranslation } from "react-i18next"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

import { $heroCard, $heroCopy, $heroHighlights, $heroPill, $title } from "./loginStyles"

export const LoginHero = memo(function LoginHero() {
  const { t } = useTranslation()
  const { themed } = useAppTheme()

  return (
    <View style={themed($heroCard)}>
      <Text preset="heading" text={t("oolshik:login.heading")} style={themed($title)} />
      <Text text={t("oolshik:login.subheading")} size="sm" style={themed($heroCopy)} />

      <View style={themed($heroHighlights)}>
        <View style={themed($heroPill)}>
          <Text text={t("oolshik:login.phoneTrust")} size="xxs" weight="medium" />
        </View>
        <View style={themed($heroPill)}>
          <Text text={t("oolshik:login.privacyTrust")} size="xxs" weight="medium" />
        </View>
        <View style={themed($heroPill)}>
          <Text text={t("oolshik:login.communityTrust")} size="xxs" weight="medium" />
        </View>
      </View>
    </View>
  )
})
