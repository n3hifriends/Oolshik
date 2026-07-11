import React, { useEffect } from "react"
import { View, Pressable } from "react-native"
import { useTranslation } from "react-i18next"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import { logEvent, AnalyticsEvent } from "@/services/analytics"

type WelcomeIntent = "getHelp" | "helpOthers" | "skip"

type HomeFeedWelcomeCardProps = {
  userName?: string
  onIntentSelected: (intent: WelcomeIntent) => void
  onOpenComposer: () => void
}

export function HomeFeedWelcomeCard({ userName, onIntentSelected, onOpenComposer }: HomeFeedWelcomeCardProps) {
  const { t } = useTranslation()
  const { theme } = useAppTheme()

  useEffect(() => {
    logEvent(AnalyticsEvent.ONBOARDING_WELCOME_VIEWED)
  }, [])

  const firstName = userName && userName !== "You" ? userName.split(" ")[0] : undefined
  const greeting = firstName
    ? t("oolshik:welcomeCard.greetingNamed", { name: firstName })
    : t("oolshik:welcomeCard.greeting")

  const handleGetHelp = () => {
    onIntentSelected("getHelp")
    onOpenComposer()
  }

  const handleHelpOthers = () => {
    onIntentSelected("helpOthers")
  }

  const handleSkip = () => {
    onIntentSelected("skip")
  }

  return (
    <View
      style={{
        marginHorizontal: 0,
        marginBottom: theme.spacing.md,
        padding: theme.spacing.lg,
        backgroundColor: theme.colors.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: theme.colors.separator,
        gap: theme.spacing.sm,
      }}
    >
      <Text
        preset="subheading"
        text={greeting}
        accessibilityRole="header"
      />
      <Text
        text={t("oolshik:welcomeCard.body")}
        style={{ color: theme.colors.textDim }}
      />
      <Text
        weight="semiBold"
        text={t("oolshik:welcomeCard.question")}
        style={{ marginTop: theme.spacing.xs }}
      />

      <View style={{ flexDirection: "row", gap: theme.spacing.sm, marginTop: theme.spacing.xs }}>
        <View style={{ flex: 1 }}>
          <Button
            text={t("oolshik:welcomeCard.getHelp")}
            onPress={handleGetHelp}
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel={t("oolshik:welcomeCard.getHelp")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            text={t("oolshik:welcomeCard.helpOthers")}
            onPress={handleHelpOthers}
            preset="reversed"
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel={t("oolshik:welcomeCard.helpOthers")}
          />
        </View>
      </View>

      <Pressable
        onPress={handleSkip}
        accessibilityRole="button"
        accessibilityLabel={t("oolshik:welcomeCard.skip")}
        style={{ alignSelf: "center", paddingVertical: theme.spacing.xs }}
      >
        <Text
          text={t("oolshik:welcomeCard.skip")}
          size="xs"
          style={{ color: theme.colors.textDim }}
        />
      </Pressable>
    </View>
  )
}
