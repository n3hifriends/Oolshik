import React from "react"
import { Pressable, TextInput, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Text } from "@/components/Text"
import { ExpandableSearch } from "@/components/ExpandableSearch"
import { Segmented, ViewMode } from "@/components/Segmented"

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
}

export function HomeFeedHeader(props: HomeFeedHeaderProps) {
  const { t } = useTranslation()

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: props.searchOpen ? "flex-start" : "center",
          gap: 10,
        }}
      >
        <Pressable
          onPress={props.onOpenProfile}
          accessibilityRole="button"
          accessibilityLabel={t("oolshik:homeScreen.openProfile")}
          accessibilityHint={t("oolshik:homeScreen.openProfileHint")}
          hitSlop={8}
          style={({ pressed }) => [
            {
              width: 38,
              height: 38,
              borderRadius: 19,
              backgroundColor: props.neutral100,
              borderWidth: 1,
              borderColor: props.primary200,
              alignItems: "center",
              justifyContent: "center",
              marginTop: props.searchOpen ? props.spacingXxxs : 0,
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
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: props.primary500,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text text={props.profileInitials} style={{ color: props.profileTextColor, fontWeight: "700" }} />
          </View>
        </Pressable>

        <View style={{ flex: 1 }}>
          <ExpandableSearch
            open={props.searchOpen}
            setOpen={props.setSearchOpen}
            value={props.rawSearch}
            onChangeText={props.onSearchChange}
            onClear={props.onClearSearch}
            inputRef={props.inputRef as React.RefObject<TextInput>}
          />
        </View>
      </View>

      <Segmented value={props.viewMode} onChange={props.onChangeViewMode} />
    </View>
  )
}
