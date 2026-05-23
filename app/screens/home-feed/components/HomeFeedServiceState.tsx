import { View, ViewStyle, TextStyle } from "react-native"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

type HomeFeedServiceStateProps = {
  title: string
  body: string
  retryLabel: string
  onRetry: () => void
  supportText?: string | null
  staleLabel?: string | null
  variant?: "full" | "inline"
}

export function HomeFeedServiceState(props: HomeFeedServiceStateProps) {
  const { themed, theme } = useAppTheme()
  const inline = props.variant === "inline"

  return (
    <View style={themed([$containerBase, inline ? $containerInline : $containerFull])}>
      <View style={themed($accentBar)} />

      <View style={themed($content)}>
        {props.staleLabel ? (
          <View style={themed($badge)}>
            <Text
              text={props.staleLabel}
              size="xxs"
              weight="medium"
              style={themed($badgeText)}
            />
          </View>
        ) : null}

        <Text text={props.title} preset={inline ? "subheading" : "heading"} size={inline ? "sm" : "md"} />
        <Text text={props.body} style={themed($bodyText)} />

        {props.supportText ? (
          <Text text={props.supportText} size="xxs" style={themed($supportText)} />
        ) : null}

        <Button
          text={props.retryLabel}
          onPress={props.onRetry}
          preset="filled"
          style={themed(inline ? $buttonInline : $buttonFull)}
          textStyle={{ color: theme.colors.palette.neutral100 }}
        />
      </View>
    </View>
  )
}

const $containerBase: ThemedStyle<ViewStyle> = ({ colors }) => ({
  overflow: "hidden",
  borderRadius: 22,
  borderWidth: 1,
  borderColor: colors.palette.warningSoft400,
  backgroundColor: colors.palette.neutral100,
  flexDirection: "row",
})

const $containerInline: ViewStyle = {
  marginTop: 12,
  marginBottom: 12,
}

const $containerFull: ViewStyle = {
  marginTop: 32,
}

const $accentBar: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 6,
  backgroundColor: colors.palette.warning500,
})

const $content: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flex: 1,
  gap: spacing.sm,
  paddingHorizontal: spacing.lg,
  paddingVertical: spacing.lg,
})

const $badge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  alignSelf: "flex-start",
  borderRadius: 999,
  paddingHorizontal: 10,
  paddingVertical: 5,
  backgroundColor: colors.palette.warningSoft400,
})

const $badgeText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.neutral800,
})

const $bodyText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

const $supportText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.neutral500,
})

const $buttonFull: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignSelf: "flex-start",
  marginTop: spacing.xs,
})

const $buttonInline: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  alignSelf: "flex-start",
  marginTop: spacing.xxs,
})
