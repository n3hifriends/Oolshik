import React from "react"
import { View } from "react-native"
import { useTranslation } from "react-i18next"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import type { HomeFeedViewMode } from "@/screens/home-feed/types"

type EmptyFeedCardProps = {
  viewMode: HomeFeedViewMode
  onGetHelp: () => void
}

export function EmptyFeedCard({ viewMode, onGetHelp }: EmptyFeedCardProps) {
  const { t } = useTranslation()
  const { theme } = useAppTheme()

  const isMine = viewMode === "mine"
  const headline = isMine
    ? t("oolshik:emptyFeed.mine.headline")
    : t("oolshik:emptyFeed.forYou.headline")
  const body = isMine
    ? t("oolshik:emptyFeed.mine.body")
    : t("oolshik:emptyFeed.forYou.body")
  const cta = isMine
    ? t("oolshik:emptyFeed.mine.cta")
    : t("oolshik:emptyFeed.forYou.cta")

  return (
    <View style={{ paddingVertical: theme.spacing.lg, gap: theme.spacing.sm }}>
      <Text preset="subheading" text={headline} />
      <Text text={body} style={{ color: theme.colors.textDim }} />
      <View style={{ marginTop: theme.spacing.xs }}>
        <Button
          text={cta}
          onPress={onGetHelp}
          style={{ borderRadius: 10, minHeight: 44 }}
          accessibilityLabel={cta}
        />
      </View>
    </View>
  )
}
