import React, { useCallback, useMemo } from "react"
import { PanResponder, Pressable, type GestureResponderEvent, View } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

import { clampRating, getRatingDescriptorKey, normalizeRating } from "./utils"

export type StarRatingProps = {
  value: number
  onChange: (value: number) => void
  max?: number
  step?: number
  size?: number
  disabled?: boolean
  showLabel?: boolean
}

export function StarRating({
  value,
  onChange,
  max = 5,
  step = 0.5,
  size = 30,
  disabled = false,
  showLabel = true,
}: StarRatingProps) {
  const { theme } = useAppTheme()
  const { colors, spacing } = theme
  const { t } = useTranslation()

  const safeMax = Math.max(1, Math.floor(max))
  const safeStep = step > 0 ? step : 0.5
  const safeSize = size > 0 ? size : 30
  const starGap = spacing.xs

  const normalizedValue = normalizeRating(value, { min: 0, max: safeMax, step: safeStep })

  const formatRating = useCallback((nextValue: number) => nextValue.toFixed(1), [])

  const commitValue = useCallback(
    (nextValue: number) => {
      if (disabled) return
      const normalized = normalizeRating(nextValue, { min: 0, max: safeMax, step: safeStep })
      if (normalized !== normalizedValue) {
        onChange(normalized)
      }
    },
    [disabled, normalizedValue, onChange, safeMax, safeStep],
  )

  const ratingFromPosition = useCallback(
    (touchX: number) => {
      const unit = safeSize + starGap
      const maxX = safeMax * safeSize + (safeMax - 1) * starGap
      const clampedX = clampRating(touchX, 0, maxX)

      const starIndex = Math.min(safeMax - 1, Math.floor(clampedX / unit))
      const starStart = starIndex * unit
      const withinStar = clampRating(clampedX - starStart, 0, safeSize)

      const leftValue = starIndex + Math.min(0.5, safeStep)
      const rightValue = starIndex + 1

      return withinStar <= safeSize / 2 ? leftValue : rightValue
    },
    [safeMax, safeSize, safeStep, starGap],
  )

  const onTouchAt = useCallback(
    (event: GestureResponderEvent) => {
      commitValue(ratingFromPosition(event.nativeEvent.locationX))
    },
    [commitValue, ratingFromPosition],
  )

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponderCapture: (_event, gestureState) => {
          if (disabled) return false
          return Math.abs(gestureState.dx) > 2 && Math.abs(gestureState.dx) >= Math.abs(gestureState.dy)
        },
        onPanResponderMove: onTouchAt,
      }),
    [disabled, onTouchAt],
  )

  const descriptor = t(`oolshik:starRating.${getRatingDescriptorKey(normalizedValue)}`)

  return (
    <View style={{ gap: spacing.xs }}>
      <View
        {...panResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={
          t("oolshik:starRating.currentRatingA11y", {
            value: formatRating(normalizedValue),
            max: formatRating(safeMax),
          })
        }
        accessibilityHint={t("oolshik:starRating.dragHint")}
        accessibilityActions={[
          { name: "increment" },
          { name: "decrement" },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment") {
            commitValue(normalizedValue + safeStep)
          }
          if (event.nativeEvent.actionName === "decrement") {
            commitValue(normalizedValue - safeStep)
          }
        }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: starGap,
          alignSelf: "flex-start",
          paddingVertical: spacing.xxs,
        }}
      >
        {Array.from({ length: safeMax }, (_, index) => {
          const fillRatio = clampRating(normalizedValue - index, 0, 1)
          const fillWidth = safeSize * fillRatio
          const leftTarget = normalizeRating(index + Math.min(0.5, safeStep), {
            min: 0,
            max: safeMax,
            step: safeStep,
          })
          const rightTarget = normalizeRating(index + 1, {
            min: 0,
            max: safeMax,
            step: safeStep,
          })

          return (
            <View
              key={`star-${index}`}
              style={{
                width: safeSize,
                height: safeSize,
                position: "relative",
                justifyContent: "center",
                alignItems: "center",
              }}
              pointerEvents="box-none"
            >
              <MaterialCommunityIcons
                name="star-outline"
                size={safeSize}
                color={colors.palette.neutral400}
              />

              {fillRatio > 0 ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: fillWidth,
                    height: safeSize,
                    overflow: "hidden",
                  }}
                >
                  <MaterialCommunityIcons
                    name="star"
                    size={safeSize}
                    color={colors.palette.primary500}
                  />
                </View>
              ) : null}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  t("oolshik:starRating.setRatingA11y", {
                    value: formatRating(leftTarget),
                  })
                }
                accessibilityState={{ disabled }}
                disabled={disabled}
                hitSlop={{
                  top: spacing.xxs,
                  bottom: spacing.xxs,
                  left: spacing.xxs,
                  right: spacing.xxxs,
                }}
                onPress={() => commitValue(leftTarget)}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: safeSize / 2,
                  height: safeSize,
                }}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  t("oolshik:starRating.setRatingA11y", {
                    value: formatRating(rightTarget),
                  })
                }
                accessibilityState={{ disabled }}
                disabled={disabled}
                hitSlop={{
                  top: spacing.xxs,
                  bottom: spacing.xxs,
                  left: spacing.xxxs,
                  right: spacing.xxs,
                }}
                onPress={() => commitValue(rightTarget)}
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  width: safeSize / 2,
                  height: safeSize,
                }}
              />
            </View>
          )
        })}
      </View>

      {showLabel ? (
        <View style={{ gap: spacing.xxxs }}>
          <Text
            text={
              t("oolshik:starRating.valueOutOf", {
                value: formatRating(normalizedValue),
                max: formatRating(safeMax),
              })
            }
            size="xs"
            style={{ color: colors.textDim }}
          />
          <Text text={descriptor} size="xs" weight="medium" />
        </View>
      ) : null}
    </View>
  )
}
