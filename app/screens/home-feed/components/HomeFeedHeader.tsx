import React from "react"
import { Pressable, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Text } from "@/components/Text"
import { ExpandableSearch } from "@/components/ExpandableSearch"
import { Segmented, ViewMode } from "@/components/Segmented"
import { useAppTheme } from "@/theme/context"
import { useResponsiveLayout } from "@/utils/useResponsiveLayout"

type HomeFeedHeaderProps = {
  searchOpen: boolean
  setSearchOpen: (value: boolean) => void
  rawSearch: string
  onSearchChange: (value: string) => void
  onClearSearch: () => void
  inputRef: React.RefObject<TextInput | null>
  onOpenProfile: () => void
  profileInitials: string
  profileTextColor: string
  viewMode: ViewMode
  onChangeViewMode: (value: ViewMode) => void
  spacingXxxs: number
  isDark: boolean
  neutral100: string
  primary200: string
  primary500: string
  condensed: boolean
  onOpenInbox: () => void
  unreadCount: number
  mineCount: number
}

export function HomeFeedHeader(props: HomeFeedHeaderProps) {
  const { t } = useTranslation()
  const { theme } = useAppTheme()
  const { scaleIcon, screenPaddingH } = useResponsiveLayout()
  const avatarSize = scaleIcon(props.condensed ? 34 : 38)
  const avatarInnerSize = scaleIcon(props.condensed ? 26 : 30)
  const bellSize = scaleIcon(props.condensed ? 22 : 24)
  const badgeCount = Math.min(props.unreadCount, 99)

  if (props.searchOpen) {
    return (
      <View
        style={{
          paddingHorizontal: screenPaddingH,
          paddingTop: props.condensed ? 4 : 8,
          paddingBottom: props.condensed ? 8 : 12,
          zIndex: 100,
          elevation: 100,
        }}
      >
        <ExpandableSearch
          open={props.searchOpen}
          setOpen={props.setSearchOpen}
          value={props.rawSearch}
          onChangeText={props.onSearchChange}
          onClear={props.onClearSearch}
          inputRef={props.inputRef as React.RefObject<TextInput>}
        />
      </View>
    )
  }

  return (
    <View
      style={{
        paddingHorizontal: screenPaddingH,
        paddingTop: props.condensed ? 4 : 8,
        paddingBottom: props.condensed ? 8 : 12,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: props.condensed ? 8 : 10,
        }}
      >
        <Pressable
          onPress={props.onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel={t("oolshik:homeScreen.openProfile")}
          accessibilityHint={t("oolshik:homeScreen.openProfileHint")}
          hitSlop={10}
          style={({ pressed }) => [
            {
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: props.neutral100,
              borderWidth: 1,
              borderColor: props.primary200,
              alignItems: "center",
              justifyContent: "center",
            },
            !props.isDark && {
              shadowColor: "#000",
              shadowOpacity: 0.08,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2,
            },
            pressed && { transform: [{ scale: 0.97 }] },
          ]}
        >
          <View
            style={{
              width: avatarInnerSize,
              height: avatarInnerSize,
              borderRadius: avatarInnerSize / 2,
              backgroundColor: props.primary500,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
            }}
          >
            <Text
              text={props.profileInitials}
              numberOfLines={1}
              style={{ color: props.profileTextColor, fontWeight: "700", fontSize: Math.round(avatarInnerSize * 0.46) }}
            />
          </View>
        </Pressable>

        <View style={{ flex: 1, minWidth: 0 }}>
          <ExpandableSearch
            open={props.searchOpen}
            setOpen={props.setSearchOpen}
            value={props.rawSearch}
            onChangeText={props.onSearchChange}
            onClear={props.onClearSearch}
            inputRef={props.inputRef as React.RefObject<TextInput>}
          />
        </View>

        <Pressable
          onPress={props.onOpenInbox}
          accessibilityRole="button"
          accessibilityLabel={
            props.unreadCount > 0
              ? t("oolshik:homeScreen.notificationsUnreadA11y", { count: badgeCount })
              : t("oolshik:homeScreen.notificationsA11y")
          }
          hitSlop={10}
          style={({ pressed }) => [
            { alignItems: "center", justifyContent: "center" },
            pressed && { opacity: 0.6 },
          ]}
        >
          <MaterialCommunityIcons
            name={props.unreadCount > 0 ? "bell-badge" : "bell-outline"}
            size={bellSize}
            color={props.unreadCount > 0 ? props.primary500 : theme.colors.textDim}
          />
          {badgeCount > 0 && (
            <View
              style={{
                position: "absolute",
                top: -4,
                right: -6,
                minWidth: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: props.primary500,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 2,
              }}
            >
              <Text
                text={String(badgeCount)}
                style={{ color: "#fff", fontSize: 9, fontWeight: "700", lineHeight: 12 }}
              />
            </View>
          )}
        </Pressable>
      </View>

      <Segmented value={props.viewMode} onChange={props.onChangeViewMode} compact mineCount={props.mineCount} />
    </View>
  )
}
