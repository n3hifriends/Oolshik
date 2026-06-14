import React, { useEffect, useRef } from "react"
import { Animated, Pressable, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useTranslation } from "react-i18next"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

export const BAR_HEIGHT = 60
export const BAR_BOTTOM_OFFSET = 12
export const BAR_HORIZONTAL = 16
const BTN_SIZE = 44
const BTN_GAP = 4
const ZONE_PAD_LEFT = 10

const BRAND_ORANGE = "#FF6B2C"

// These let HomeFeedScreen calculate animation origin for SpotlightComposer
// without needing async layout measurement.
export const BAR_MIC_CENTER_X = BAR_HORIZONTAL + ZONE_PAD_LEFT + BTN_SIZE / 2
export const BAR_PEN_CENTER_X = BAR_HORIZONTAL + ZONE_PAD_LEFT + BTN_SIZE + BTN_GAP + BTN_SIZE / 2

interface HomeFeedBottomBarProps {
  onVoiceCapture: () => void
  onTypeCapture: () => void
  onCreate: () => void
  visible: boolean
  condensed: boolean
}

export function HomeFeedBottomBar(props: HomeFeedBottomBarProps) {
  const { t } = useTranslation()
  const { theme } = useAppTheme()
  const insets = useSafeAreaInsets()

  const barOpacity = useRef(new Animated.Value(props.visible ? 1 : 0)).current
  const labelOpacity = useRef(new Animated.Value(props.condensed ? 0 : 1)).current

  useEffect(() => {
    Animated.timing(barOpacity, {
      toValue: props.visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }, [props.visible, barOpacity])

  useEffect(() => {
    Animated.timing(labelOpacity, {
      toValue: props.condensed ? 0 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start()
  }, [props.condensed, labelOpacity])

  const dividerColor = theme.isDark ? "rgba(255,255,255,0.1)" : "#E5E7EB"
  const barBg = theme.isDark ? "rgba(28,28,30,0.96)" : "#FFFFFF"
  const barBorder = theme.isDark ? "rgba(255,107,44,0.15)" : "#E5E7EB"
  const createTextColor = theme.isDark ? theme.colors.text : "#3C3836"
  const chevronColor = theme.isDark ? "rgba(255,255,255,0.4)" : "#9CA3AF"
  const iconBg = "rgba(255,107,44,0.08)"
  const iconBgPressed = "rgba(255,107,44,0.14)"

  return (
    <Animated.View
      pointerEvents={props.visible ? "auto" : "none"}
      style={{
        position: "absolute",
        left: BAR_HORIZONTAL,
        right: BAR_HORIZONTAL,
        bottom: insets.bottom + BAR_BOTTOM_OFFSET,
        height: BAR_HEIGHT,
        borderRadius: BAR_HEIGHT / 2,
        flexDirection: "row",
        alignItems: "center",
        opacity: barOpacity,
        backgroundColor: barBg,
        borderWidth: 1,
        borderColor: barBorder,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
      }}
    >
      {/* Mic button */}
      <Pressable
        onPress={props.onVoiceCapture}
        accessibilityLabel={t("oolshik:composer.recordTaskA11y")}
        accessibilityRole="button"
        hitSlop={4}
        style={({ pressed }) => ({
          width: BTN_SIZE,
          height: BTN_SIZE,
          marginLeft: ZONE_PAD_LEFT,
          borderRadius: BTN_SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? iconBgPressed : iconBg,
        })}
      >
        <MaterialCommunityIcons name="microphone" size={24} color={BRAND_ORANGE} />
      </Pressable>

      {/* Pen button */}
      <Pressable
        onPress={props.onTypeCapture}
        accessibilityLabel={t("oolshik:composer.typeTaskA11y")}
        accessibilityRole="button"
        hitSlop={4}
        style={({ pressed }) => ({
          width: BTN_SIZE,
          height: BTN_SIZE,
          marginLeft: BTN_GAP,
          borderRadius: BTN_SIZE / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pressed ? iconBgPressed : iconBg,
        })}
      >
        <MaterialCommunityIcons name="pencil" size={20} color={BRAND_ORANGE} />
      </Pressable>

      {/* Divider */}
      <View
        style={{
          width: 1,
          height: 32,
          marginHorizontal: 10,
          backgroundColor: dividerColor,
        }}
      />

      {/* Create task zone */}
      <Pressable
        onPress={props.onCreate}
        accessibilityLabel={t("oolshik:create")}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flex: 1,
          height: "100%",
          flexDirection: "row",
          alignItems: "center",
          paddingLeft: 4,
          paddingRight: 16,
          borderTopRightRadius: BAR_HEIGHT / 2,
          borderBottomRightRadius: BAR_HEIGHT / 2,
          backgroundColor: pressed ? "rgba(255,107,44,0.06)" : "transparent",
        })}
      >
        <MaterialCommunityIcons name="plus-circle" size={20} color={BRAND_ORANGE} />
        <Animated.View
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            marginLeft: 8,
            opacity: labelOpacity,
          }}
        >
          <Text
            text={t("oolshik:create")}
            style={{
              flex: 1,
              fontSize: 15,
              fontWeight: "600",
              color: createTextColor,
            }}
          />
          <MaterialCommunityIcons name="chevron-right" size={18} color={chevronColor} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}
