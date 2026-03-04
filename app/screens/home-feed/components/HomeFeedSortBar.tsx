import React from "react"
import { Pressable, View } from "react-native"
import { useTranslation } from "react-i18next"

import { SectionCard } from "@/components/SectionCard"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type { HomeFeedSortKey, HomeFeedSortState } from "@/screens/home-feed/types"

type HomeFeedSortBarProps = {
  sort: HomeFeedSortState
  onToggleSort: (key: HomeFeedSortKey) => void
}

type SortButtonProps = {
  label: string
  active: boolean
  direction: HomeFeedSortState["direction"]
  onPress: () => void
  accessibilityLabel: string
}

const SortButton = React.memo(function SortButton(props: SortButtonProps) {
  const { theme } = useAppTheme()
  const palette = theme.colors.palette

  const indicator = props.active ? (props.direction === "asc" ? "↑" : "↓") : "↕"

  return (
    <Pressable
      onPress={props.onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: props.active }}
      accessibilityLabel={props.accessibilityLabel}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 42,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: props.active ? palette.primary500 : palette.neutral200,
        backgroundColor: props.active ? palette.primary100 : palette.neutral100,
        paddingHorizontal: 10,
        paddingVertical: 8,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <Text
          text={props.label}
          size="xs"
          weight="medium"
          numberOfLines={1}
          style={{ color: props.active ? palette.primary500 : palette.neutral700, flex: 1 }}
        />

        <View
          style={{
            minWidth: 28,
            height: 22,
            borderRadius: 999,
            paddingHorizontal: 6,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: props.active ? palette.primary500 : palette.neutral200,
          }}
        >
          <Text
            text={indicator}
            size="xxs"
            weight="bold"
            style={{ color: props.active ? palette.neutral100 : palette.neutral600 }}
          />
        </View>
      </View>
    </Pressable>
  )
})

export const HomeFeedSortBar = React.memo(function HomeFeedSortBar(props: HomeFeedSortBarProps) {
  const { t } = useTranslation()
  const { theme } = useAppTheme()
  const palette = theme.colors.palette

  const getSortDescription = (key: HomeFeedSortKey, direction: HomeFeedSortState["direction"]) => {
    if (key === "time") {
      return direction === "asc"
        ? t("oolshik:homeScreen.sortNewestFirst", { defaultValue: "Newest first" })
        : t("oolshik:homeScreen.sortOldestFirst", { defaultValue: "Oldest first" })
    }

    return direction === "asc"
      ? t("oolshik:homeScreen.sortNearestFirst", { defaultValue: "Nearest first" })
      : t("oolshik:homeScreen.sortFarthestFirst", { defaultValue: "Farthest first" })
  }

  const activeSortDescription = getSortDescription(props.sort.key, props.sort.direction)
  const timeDescription = getSortDescription(
    "time",
    props.sort.key === "time" ? props.sort.direction : "asc",
  )
  const distanceDescription = getSortDescription(
    "distance",
    props.sort.key === "distance" ? props.sort.direction : "asc",
  )

  const reverseHint = t("oolshik:homeScreen.sortReverseHint", {
    defaultValue: "Tap again to reverse order",
  })

  return (
    <View style={{ marginBottom: 8 }}>
      <SectionCard style={{ paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            marginBottom: 8,
          }}
        >
          <Text
            text={t("oolshik:homeScreen.sortLabel", { defaultValue: "Sort" })}
            size="xxs"
            weight="bold"
            numberOfLines={1}
            style={{ color: palette.neutral700, flexShrink: 1 }}
          />

          <View
            style={{
              flexShrink: 1,
              maxWidth: "72%",
              borderRadius: 999,
              backgroundColor: palette.neutral100,
              borderWidth: 1,
              borderColor: palette.neutral200,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <Text
              text={activeSortDescription}
              size="xxs"
              weight="medium"
              numberOfLines={1}
              ellipsizeMode="tail"
              style={{ color: palette.neutral700 }}
            />
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <SortButton
            label={t("oolshik:homeScreen.sortTime", { defaultValue: "Time" })}
            active={props.sort.key === "time"}
            direction={props.sort.key === "time" ? props.sort.direction : "asc"}
            onPress={() => props.onToggleSort("time")}
            accessibilityLabel={`${t("oolshik:homeScreen.sortTime", { defaultValue: "Time" })}. ${timeDescription}. ${reverseHint}`}
          />

          <SortButton
            label={t("oolshik:homeScreen.sortDistance", { defaultValue: "Distance" })}
            active={props.sort.key === "distance"}
            direction={props.sort.key === "distance" ? props.sort.direction : "asc"}
            onPress={() => props.onToggleSort("distance")}
            accessibilityLabel={`${t("oolshik:homeScreen.sortDistance", { defaultValue: "Distance" })}. ${distanceDescription}. ${reverseHint}`}
          />
        </View>
      </SectionCard>
    </View>
  )
})
