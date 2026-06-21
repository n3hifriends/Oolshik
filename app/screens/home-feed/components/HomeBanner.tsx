import React, { useCallback, useEffect, useRef } from "react"
import { Animated, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useAppTheme } from "@/theme/context"
import { Text } from "@/components/Text"
import { PressableIcon } from "@/components/Icon"

interface HomeBannerProps {
  title: string
  message: string
  type: string
  autoDismissSeconds: number
  onDismiss: () => void
}

export function HomeBanner({ title, message, type, autoDismissSeconds, onDismiss }: HomeBannerProps) {
  const { t } = useTranslation()
  const { theme: { colors } } = useAppTheme()

  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(-8)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start()
  }, [opacity, translateY])

  const handleDismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -8, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) onDismiss()
    })
  }, [opacity, translateY, onDismiss])

  useEffect(() => {
    if (autoDismissSeconds <= 0) return
    const timer = setTimeout(handleDismiss, autoDismissSeconds * 1000)
    return () => clearTimeout(timer)
  }, [autoDismissSeconds, handleDismiss])

  const palette = colors.palette
  let bannerBg: string
  let accentColor: string
  switch (type) {
    case "warning":
      bannerBg = palette.warningSoft400
      accentColor = palette.warning500
      break
    case "success":
      bannerBg = palette.successSoft400
      accentColor = palette.success500
      break
    case "urgent":
      bannerBg = palette.angry100
      accentColor = palette.angry500
      break
    default:
      bannerBg = palette.primary100
      accentColor = palette.primary500
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: bannerBg, opacity, transform: [{ translateY }] },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.content}>
        {title ? (
          <Text
            text={title}
            weight="semiBold"
            size="xs"
            numberOfLines={2}
            style={{ color: colors.text }}
          />
        ) : null}
        {message ? (
          <Text
            text={message}
            size="xs"
            numberOfLines={3}
            style={{ color: colors.textDim, marginTop: title ? 2 : 0 }}
          />
        ) : null}
      </View>
      <PressableIcon
        icon="x"
        size={16}
        color={colors.textDim}
        onPress={handleDismiss}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={t("oolshik:homeScreen.bannerDismissA11y")}
        containerStyle={styles.dismissButton}
      />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "stretch",
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 4,
    borderRadius: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  accentBar: {
    width: 3,
  },
  content: {
    flex: 1,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 4,
  },
  dismissButton: {
    padding: 12,
    alignSelf: "flex-start",
  },
})
