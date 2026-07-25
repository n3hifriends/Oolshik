import { useEffect, useRef } from "react"
import { Animated, TextStyle, View, ViewStyle } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"

import { Button, ButtonProps } from "@/components/Button"
import { Screen } from "@/components/Screen"
import { useReduceMotion } from "@/components/SpotlightComposer/useReduceMotion"
import { Text, TextProps } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { ThemedStyle } from "@/theme/types"

export type AppGateTone = "info" | "warning" | "brand"

export interface AppGateAction {
  tx?: ButtonProps["tx"]
  text?: ButtonProps["text"]
  txOptions?: ButtonProps["txOptions"]
  onPress: () => void
  loading?: boolean
  disabled?: boolean
}

export interface AppGateScreenProps {
  tone: AppGateTone
  icon: keyof typeof MaterialCommunityIcons.glyphMap
  eyebrowTx?: TextProps["tx"]
  titleTx?: TextProps["tx"]
  /** Message text — may come from Remote Config, so plain string is the primary path. */
  message: string
  /** Optional small info card (e.g. maintenance ETA) shown below the message. */
  infoCardText?: string
  primaryAction: AppGateAction
  secondaryAction?: AppGateAction
  /** Lowest-emphasis text-link action, e.g. "Log out". */
  tertiaryAction?: AppGateAction
  /** Retry/last-checked feedback line. Announced to screen readers when it changes. */
  statusText?: string
  statusTone?: "neutral" | "error"
}

const TONE_COLOR_KEYS: Record<
  AppGateTone,
  {
    bg: "gateInfoBg" | "gateWarningBg" | "gateBrandBg"
    fg: "gateInfoFg" | "gateWarningFg" | "gateBrandFg"
  }
> = {
  info: { bg: "gateInfoBg", fg: "gateInfoFg" },
  warning: { bg: "gateWarningBg", fg: "gateWarningFg" },
  brand: { bg: "gateBrandBg", fg: "gateBrandFg" },
}

export function AppGateScreen(props: AppGateScreenProps) {
  const {
    tone,
    icon,
    eyebrowTx,
    titleTx,
    message,
    infoCardText,
    primaryAction,
    secondaryAction,
    tertiaryAction,
    statusText,
    statusTone = "neutral",
  } = props

  const { themed, theme } = useAppTheme()
  const reduceMotion = useReduceMotion()
  const entrance = useRef(new Animated.Value(0)).current
  const hasAnimatedRef = useRef(false)

  useEffect(() => {
    // useReduceMotion() starts false and flips async once the real OS setting
    // resolves — re-run whenever it changes, not just on mount, otherwise a
    // reduce-motion user's first render races the animation start below.
    if (reduceMotion) {
      entrance.stopAnimation()
      entrance.setValue(1)
      return
    }
    if (hasAnimatedRef.current) return
    hasAnimatedRef.current = true
    Animated.timing(entrance, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start()
  }, [reduceMotion, entrance])

  const toneColors = TONE_COLOR_KEYS[tone]
  const iconBg = theme.colors[toneColors.bg]
  const iconFg = theme.colors[toneColors.fg]

  return (
    <Screen
      preset="auto"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={themed($contentContainer)}
    >
      <Animated.View
        style={[
          $centerColumn,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
              },
            ],
          },
        ]}
      >
        <View style={[$iconCircle, { backgroundColor: iconBg }]}>
          <MaterialCommunityIcons name={icon} size={40} color={iconFg} />
        </View>

        {!!eyebrowTx && (
          <Text
            tx={eyebrowTx}
            weight="medium"
            style={[$eyebrow, { color: iconFg }]}
            maxFontSizeMultiplier={1.4}
          />
        )}

        <Text preset="heading" tx={titleTx} style={themed($title)} />

        <Text text={message} style={themed($message)} />

        {!!infoCardText && (
          <View style={themed($infoCard)}>
            <Text text={infoCardText} style={themed($infoCardText)} />
          </View>
        )}
      </Animated.View>

      <View style={themed($actions)}>
        <Button
          tx={primaryAction.tx}
          text={primaryAction.text}
          txOptions={primaryAction.txOptions}
          onPress={primaryAction.onPress}
          loading={primaryAction.loading}
          disabled={primaryAction.disabled}
          preset={tone === "brand" ? "filled" : "default"}
          style={$primaryButton}
        />

        {!!secondaryAction && (
          <Button
            tx={secondaryAction.tx}
            text={secondaryAction.text}
            txOptions={secondaryAction.txOptions}
            onPress={secondaryAction.onPress}
            loading={secondaryAction.loading}
            disabled={secondaryAction.disabled}
            preset="default"
            style={themed($secondaryButton)}
          />
        )}

        {!!tertiaryAction && (
          <Text
            tx={tertiaryAction.tx}
            text={tertiaryAction.text}
            txOptions={tertiaryAction.txOptions}
            onPress={tertiaryAction.disabled ? undefined : tertiaryAction.onPress}
            style={themed($tertiaryAction)}
            accessibilityRole="button"
          />
        )}

        {!!statusText && (
          <Text
            text={statusText}
            accessibilityLiveRegion="polite"
            style={[themed($statusLine), statusTone === "error" && { color: theme.colors.error }]}
          />
        )}
      </View>
    </Screen>
  )
}

const $contentContainer: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexGrow: 1,
  justifyContent: "space-between",
  paddingHorizontal: spacing.lg,
  paddingTop: spacing.xxl,
  paddingBottom: spacing.lg,
})

const $centerColumn: ViewStyle = {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
  maxWidth: 480,
  alignSelf: "center",
  width: "100%",
}

const $iconCircle: ViewStyle = {
  width: 88,
  height: 88,
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 20,
}

const $eyebrow: TextStyle = {
  textTransform: "uppercase",
  letterSpacing: 0.6,
  fontSize: 12,
  marginBottom: 8,
  textAlign: "center",
}

const $title: ThemedStyle<TextStyle> = ({ spacing }) => ({
  textAlign: "center",
  marginBottom: spacing.sm,
})

const $message: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  textAlign: "center",
  color: colors.textDim,
  lineHeight: 22,
  marginBottom: spacing.md,
})

const $infoCard: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  backgroundColor: colors.surface,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.border,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
  marginTop: spacing.xs,
  alignSelf: "stretch",
})

const $infoCardText: ThemedStyle<TextStyle> = ({ colors }) => ({
  textAlign: "center",
  color: colors.text,
})

const $actions: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: "100%",
  maxWidth: 480,
  alignSelf: "center",
  paddingTop: spacing.lg,
})

const $primaryButton: ViewStyle = {
  width: "100%",
}

const $secondaryButton: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  width: "100%",
  marginTop: spacing.sm,
})

const $tertiaryAction: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  textAlign: "center",
  color: colors.textDim,
  marginTop: spacing.md,
  textDecorationLine: "underline",
})

const $statusLine: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  textAlign: "center",
  color: colors.textDim,
  fontSize: 12,
  marginTop: spacing.md,
})
