import { memo } from "react"
import { StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { SupportedLocaleTag } from "@/i18n/locale"

import { LanguageToggle } from "./LanguageToggle"
import { $heroCard, $heroRow } from "./loginStyles"

interface LoginHeroProps {
  currentLanguage: SupportedLocaleTag
  onLanguageChange: (tag: SupportedLocaleTag) => void
}

export const LoginHero = memo(function LoginHero({ currentLanguage, onLanguageChange }: LoginHeroProps) {
  const { t } = useTranslation()
  const { themed } = useAppTheme()

  return (
    <View style={themed($heroCard)}>
      <View style={themed($heroRow)}>
        <Text preset="heading" text={t("oolshik:login.heading")} style={styles.heading} />
        <LanguageToggle currentLanguage={currentLanguage} onLanguageChange={onLanguageChange} />
      </View>
    </View>
  )
})

const styles = StyleSheet.create({
  heading: {
    flex: 1,
  },
})
