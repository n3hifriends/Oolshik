import React, { useCallback, useEffect, useRef, useState } from "react"
import { Animated, BackHandler, Easing, Pressable, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Text } from "@/components/Text"
import { SectionCard } from "@/components/SectionCard"
import { typography } from "@/theme/typography"
import { colors } from "@/theme/colors"
import { addToSearchHistory, clearSearchHistory, getSearchHistory } from "@/utils/searchHistory"

type Props = {
  open: boolean
  setOpen: (v: boolean) => void
  value: string
  onChangeText: (t: string) => void
  onClear: () => void
  inputRef: React.RefObject<TextInput>
}

export const ExpandableSearch: React.FC<Props> = ({
  open,
  setOpen,
  value,
  onChangeText,
  onClear,
  inputRef,
}) => {
  const { t } = useTranslation()
  const underlineAnim = useRef(new Animated.Value(open ? 1 : 0)).current
  const suggestionsAnim = useRef(new Animated.Value(0)).current
  const [history, setHistory] = useState<string[]>([])

  const showSuggestions = open && value.length === 0 && history.length > 0

  useEffect(() => {
    Animated.timing(underlineAnim, {
      toValue: open ? 1 : 0,
      duration: 280,
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: false,
    }).start()
  }, [open, underlineAnim])

  useEffect(() => {
    Animated.timing(suggestionsAnim, {
      toValue: showSuggestions ? 1 : 0,
      duration: 200,
      easing: showSuggestions ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
      useNativeDriver: false,
    }).start()
  }, [showSuggestions, suggestionsAnim])

  useEffect(() => {
    if (open) {
      const h = getSearchHistory()
      setHistory(h)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open, inputRef])

  const handleClose = useCallback(() => {
    if (value.trim().length >= 2) addToSearchHistory(value.trim())
    onClear()
    setOpen(false)
  }, [value, onClear, setOpen])

  useEffect(() => {
    if (!open) return
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleClose()
      return true
    })
    return () => sub.remove()
  }, [open, handleClose])

  const underlineWidth = underlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  })

  const suggestionsMaxHeight = suggestionsAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 280],
  })

  if (!open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="search"
        accessibilityLabel={t("oolshik:search.open")}
        style={({ pressed }) => ({
          flex: 1,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.palette.neutral200,
          borderWidth: 1,
          borderColor: "#E5E1DF",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 12,
          gap: 8,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <MaterialCommunityIcons name="magnify" size={16} color="#AAA" />
        <Text
          text={t("oolshik:search.placeholder")}
          numberOfLines={1}
          style={{
            flex: 1,
            color: "#AAA",
            fontSize: 13,
            fontFamily: typography.primary.normal,
          }}
        />
      </Pressable>
    )
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          minHeight: 46,
          borderRadius: 23,
          backgroundColor: colors.palette.neutral100,
          borderWidth: 1,
          borderColor: colors.palette.primary200,
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingLeft: 10,
          paddingRight: 8,
        }}
      >
        <Pressable
          onPress={handleClose}
          accessibilityRole="button"
          accessibilityLabel={t("oolshik:search.close")}
          hitSlop={10}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={21}
            color={colors.palette.neutral700}
          />
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <TextInput
            ref={inputRef}
            value={value}
            onChangeText={onChangeText}
            placeholder={t("oolshik:search.placeholder")}
            placeholderTextColor="#AAA"
            returnKeyType="search"
            autoCapitalize="none"
            onSubmitEditing={() => {
              if (value.trim().length >= 2) {
                addToSearchHistory(value.trim())
                setHistory(getSearchHistory())
              }
            }}
            style={{
              height: 42,
              paddingVertical: 0,
              paddingHorizontal: 0,
              fontSize: 15,
              lineHeight: 20,
              fontFamily: typography.primary.medium,
              color: colors.palette.neutral700,
              textAlignVertical: "center",
              includeFontPadding: false,
            }}
          />
          <Animated.View
            style={{
              height: 2,
              width: underlineWidth,
              backgroundColor: colors.palette.primary500,
              borderRadius: 1,
            }}
          />
        </View>

        {value.length > 0 && (
          <Pressable
            onPress={onClear}
            accessibilityRole="button"
            accessibilityLabel={t("oolshik:search.clear")}
            hitSlop={10}
          >
            <MaterialCommunityIcons name="close-circle" size={18} color="#BBB" />
          </Pressable>
        )}
      </View>

      <Animated.View
        style={{
          maxHeight: suggestionsMaxHeight,
          opacity: suggestionsAnim,
          overflow: "hidden",
          marginTop: 8,
        }}
      >
        <SectionCard style={{ paddingVertical: 4, paddingHorizontal: 4 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 8,
              paddingVertical: 4,
            }}
          >
            <Text
              text={t("oolshik:search.recent")}
              size="xxs"
              weight="semiBold"
              style={{ color: colors.palette.neutral600 }}
            />
            <Pressable
              onPress={() => {
                clearSearchHistory()
                setHistory([])
              }}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text
                text={t("oolshik:search.clearHistory")}
                size="xxs"
                style={{ color: colors.palette.primary500 }}
              />
            </Pressable>
          </View>

          {history.map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                onChangeText(item)
                addToSearchHistory(item)
              }}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingHorizontal: 8,
                paddingVertical: 10,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <MaterialCommunityIcons name="history" size={16} color="#BBB" />
              <Text
                text={item}
                size="xs"
                numberOfLines={1}
                style={{ flex: 1, color: colors.palette.neutral700 }}
              />
            </Pressable>
          ))}
        </SectionCard>
      </Animated.View>
    </View>
  )
}
