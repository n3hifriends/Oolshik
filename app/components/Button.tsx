import { ComponentType } from "react"
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  PressableStateCallbackType,
  StyleProp,
  TextStyle,
  ViewStyle,
} from "react-native"

import { useAppTheme } from "@/theme/context"
import { $styles } from "@/theme/styles"
import type { ThemedStyle, ThemedStyleArray } from "@/theme/types"

import { Text, TextProps } from "./Text"

type Presets = "default" | "filled" | "reversed"

export interface ButtonAccessoryProps {
  style: StyleProp<any>
  pressableState: PressableStateCallbackType
  disabled?: boolean
}

export interface ButtonProps extends PressableProps {
  /**
   * Text which is looked up via i18n.
   */
  tx?: TextProps["tx"]
  /**
   * The text to display if not using `tx` or nested components.
   */
  text?: TextProps["text"]
  /**
   * Optional options to pass to i18n. Useful for interpolation
   * as well as explicitly setting locale or translation fallbacks.
   */
  txOptions?: TextProps["txOptions"]
  /**
   * An optional style override useful for padding & margin.
   */
  style?: StyleProp<ViewStyle>
  /**
   * An optional style override for the "pressed" state.
   */
  pressedStyle?: StyleProp<ViewStyle>
  /**
   * An optional style override for the button text.
   */
  textStyle?: StyleProp<TextStyle>
  /**
   * An optional style override for the button text when in the "pressed" state.
   */
  pressedTextStyle?: StyleProp<TextStyle>
  /**
   * An optional style override for the button text when in the "disabled" state.
   */
  disabledTextStyle?: StyleProp<TextStyle>
  /**
   * One of the different types of button presets.
   */
  preset?: Presets
  /**
   * An optional component to render on the right side of the text.
   * Example: `RightAccessory={(props) => <View {...props} />}`
   */
  RightAccessory?: ComponentType<ButtonAccessoryProps>
  /**
   * An optional component to render on the left side of the text.
   * Example: `LeftAccessory={(props) => <View {...props} />}`
   */
  LeftAccessory?: ComponentType<ButtonAccessoryProps>
  /**
   * Children components.
   */
  children?: React.ReactNode
  /**
   * disabled prop, accessed directly for declarative styling reasons.
   * https://reactnative.dev/docs/pressable#disabled
   */
  disabled?: boolean
  /**
   * An optional style override for the disabled state
   */
  disabledStyle?: StyleProp<ViewStyle>
  /**
   * Shows a busy state and disables button interactions.
   */
  loading?: boolean
}

/**
 * A component that allows users to take actions and make choices.
 * Wraps the Text component with a Pressable component.
 * @see [Documentation and Examples]{@link https://docs.infinite.red/ignite-cli/boilerplate/app/components/Button/}
 * @param {ButtonProps} props - The props for the `Button` component.
 * @returns {JSX.Element} The rendered `Button` component.
 * @example
 * <Button
 *   tx="common:ok"
 *   style={styles.button}
 *   textStyle={styles.buttonText}
 *   onPress={handleButtonPress}
 * />
 */
export function Button(props: ButtonProps) {
  const {
    tx,
    text,
    txOptions,
    style: $viewStyleOverride,
    pressedStyle: $pressedViewStyleOverride,
    textStyle: $textStyleOverride,
    pressedTextStyle: $pressedTextStyleOverride,
    disabledTextStyle: $disabledTextStyleOverride,
    children,
    RightAccessory,
    LeftAccessory,
    disabled,
    disabledStyle: $disabledViewStyleOverride,
    loading = false,
    ...rest
  } = props

  const { themed, theme } = useAppTheme()

  const preset: Presets = props.preset ?? "default"
  const isDisabled = !!disabled || loading
  const spinnerColor = themed($spinnerColorPresets[preset]).color ?? theme.colors.text

  /**
   * @param {PressableStateCallbackType} root0 - The root object containing the pressed state.
   * @param {boolean} root0.pressed - The pressed state.
   * @returns {StyleProp<ViewStyle>} The view style based on the pressed state.
   */
  function $viewStyle({ pressed }: PressableStateCallbackType): StyleProp<ViewStyle> {
    return [
      themed($viewPresets[preset]),
      $viewStyleOverride,
      !isDisabled && !!pressed && themed([$pressedViewPresets[preset], $pressedViewStyleOverride]),
      isDisabled && themed($disabledViewPresets[preset]),
      isDisabled && $disabledViewStyleOverride,
    ]
  }
  /**
   * @param {PressableStateCallbackType} root0 - The root object containing the pressed state.
   * @param {boolean} root0.pressed - The pressed state.
   * @returns {StyleProp<TextStyle>} The text style based on the pressed state.
   */
  function $textStyle({ pressed }: PressableStateCallbackType): StyleProp<TextStyle> {
    return [
      themed($textPresets[preset]),
      $textStyleOverride,
      !isDisabled && !!pressed && themed([$pressedTextPresets[preset], $pressedTextStyleOverride]),
      isDisabled && themed($disabledTextPresets[preset]),
      isDisabled && $disabledTextStyleOverride,
    ]
  }

  return (
    <Pressable
      style={$viewStyle}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      android_ripple={themed($ripplePresets[preset])}
      {...rest}
      disabled={isDisabled}
    >
      {(state) => (
        <>
          {!loading && !!LeftAccessory && (
            <LeftAccessory
              style={$leftAccessoryStyle}
              pressableState={state}
              disabled={isDisabled}
            />
          )}

          {loading ? (
            <ActivityIndicator
              color={spinnerColor}
              size="small"
              style={themed($loadingSpinnerStyle)}
            />
          ) : null}

          <Text tx={tx} text={text} txOptions={txOptions} style={$textStyle(state)}>
            {children}
          </Text>

          {!loading && !!RightAccessory && (
            <RightAccessory
              style={$rightAccessoryStyle}
              pressableState={state}
              disabled={isDisabled}
            />
          )}
        </>
      )}
    </Pressable>
  )
}

const $baseViewStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  minHeight: 50,
  borderRadius: 14,
  justifyContent: "center",
  alignItems: "center",
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.lg,
  overflow: "hidden",
})

const $baseTextStyle: ThemedStyle<TextStyle> = ({ typography }) => ({
  fontSize: 15,
  lineHeight: 20,
  fontFamily: typography.primary.medium,
  letterSpacing: 0.2,
  textAlign: "center",
  flexShrink: 1,
  flexGrow: 0,
  zIndex: 2,
})

const $rightAccessoryStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginStart: spacing.xs,
  zIndex: 1,
})
const $leftAccessoryStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginEnd: spacing.xs,
  zIndex: 1,
})

const $loadingSpinnerStyle: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  marginEnd: spacing.xs,
})

const $viewPresets: Record<Presets, ThemedStyleArray<ViewStyle>> = {
  default: [
    $styles.row,
    $baseViewStyle,
    ({ colors }) => ({
      borderWidth: 1,
      borderColor: colors.palette.neutral300,
      backgroundColor: colors.palette.neutral100,
    }),
  ],
  filled: [
    $styles.row,
    $baseViewStyle,
    ({ colors }) => ({
      borderWidth: 1,
      borderColor: colors.palette.primary500,
      backgroundColor: colors.palette.primary500,
      shadowColor: colors.palette.overlay50,
      shadowOpacity: 0.16,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    }),
  ],
  reversed: [
    $styles.row,
    $baseViewStyle,
    ({ colors }) => ({
      borderWidth: 1,
      borderColor: colors.palette.neutral700,
      backgroundColor: colors.palette.neutral800,
    }),
  ],
}

const $textPresets: Record<Presets, ThemedStyleArray<TextStyle>> = {
  default: [$baseTextStyle, ({ colors }) => ({ color: colors.palette.neutral700 })],
  filled: [$baseTextStyle, ({ colors }) => ({ color: colors.palette.neutral100 })],
  reversed: [$baseTextStyle, ({ colors }) => ({ color: colors.palette.neutral100 })],
}

const $pressedViewPresets: Record<Presets, ThemedStyle<ViewStyle>> = {
  default: ({ colors }) => ({
    backgroundColor: colors.palette.neutral200,
    borderColor: colors.palette.primary300,
    transform: [{ scale: 0.985 }],
  }),
  filled: ({ colors }) => ({
    backgroundColor: colors.palette.primary400,
    borderColor: colors.palette.primary400,
    transform: [{ scale: 0.985 }],
  }),
  reversed: ({ colors }) => ({
    backgroundColor: colors.palette.neutral700,
    borderColor: colors.palette.neutral700,
    transform: [{ scale: 0.985 }],
  }),
}

const $pressedTextPresets: Record<Presets, ThemedStyle<TextStyle>> = {
  default: () => ({ opacity: 0.95 }),
  filled: () => ({ opacity: 0.95 }),
  reversed: () => ({ opacity: 0.95 }),
}

const $disabledViewPresets: Record<Presets, ThemedStyle<ViewStyle>> = {
  default: ({ colors }) => ({
    backgroundColor: colors.palette.neutral200,
    borderColor: colors.palette.neutral300,
    opacity: 0.7,
  }),
  filled: ({ colors }) => ({
    backgroundColor: colors.palette.neutral300,
    borderColor: colors.palette.neutral300,
    opacity: 0.75,
    shadowOpacity: 0,
    elevation: 0,
  }),
  reversed: ({ colors }) => ({
    backgroundColor: colors.palette.neutral600,
    borderColor: colors.palette.neutral500,
    opacity: 0.75,
  }),
}

const $disabledTextPresets: Record<Presets, ThemedStyle<TextStyle>> = {
  default: ({ colors }) => ({ color: colors.palette.neutral500 }),
  filled: ({ colors }) => ({ color: colors.palette.neutral600 }),
  reversed: ({ colors }) => ({ color: colors.palette.neutral300 }),
}

const $ripplePresets: Record<Presets, ThemedStyle<{ color: string }>> = {
  default: ({ colors }) => ({ color: colors.palette.primary100 }),
  filled: ({ colors }) => ({ color: colors.palette.primary300 }),
  reversed: ({ colors }) => ({ color: colors.palette.neutral500 }),
}

const $spinnerColorPresets: Record<Presets, ThemedStyle<{ color: string }>> = {
  default: ({ colors }) => ({ color: colors.palette.neutral700 }),
  filled: ({ colors }) => ({ color: colors.palette.neutral100 }),
  reversed: ({ colors }) => ({ color: colors.palette.neutral100 }),
}
