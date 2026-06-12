import { memo } from "react"
import { View } from "react-native"
import { useTranslation } from "react-i18next"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

import { $heroCard, $title } from "./loginStyles"

export const LoginHero = memo(function LoginHero() {
  const { t } = useTranslation()
  const { themed } = useAppTheme()

  return (
    <View style={themed($heroCard)}>
      <Text preset="heading" text={t("oolshik:login.heading")} style={themed($title)} />
    </View>
  )
})
