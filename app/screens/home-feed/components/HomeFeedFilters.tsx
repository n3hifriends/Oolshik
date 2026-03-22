import React, { useMemo } from "react"
import { Pressable, View } from "react-native"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/SectionCard"
import { StatusChip } from "@/components/StatusChip"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import type {
  HomeFeedSortKey,
  HomeFeedSortState,
  HomeFeedStatus,
  HomeFeedViewMode,
  Radius,
} from "@/screens/home-feed/types"

type HomeFeedFiltersProps = {
  viewMode: HomeFeedViewMode
  radiusMeters: Radius
  onSetRadius: (radius: Radius) => void
  selectedStatuses: Set<HomeFeedStatus>
  availableStatuses: HomeFeedStatus[]
  onToggleStatus: (status: HomeFeedStatus) => void
  onSelectAllStatuses: (statuses: HomeFeedStatus[]) => void
  sort: HomeFeedSortState
  onToggleSort: (key: HomeFeedSortKey) => void
  expanded: boolean
  onToggleExpanded: () => void
  condensed: boolean
  resultCount: number
}

type SortControlButtonProps = {
  label: string
  active: boolean
  direction: HomeFeedSortState["direction"]
  onPress: () => void
}

type SummaryChipProps = {
  text: string
}

function SummaryChip({ text }: SummaryChipProps) {
  const { theme } = useAppTheme()
  return (
    <View
      style={{
        paddingHorizontal: theme.spacing.sm,
        paddingVertical: theme.spacing.xxxs,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: theme.colors.palette.neutral200,
        backgroundColor: theme.colors.palette.neutral100,
      }}
    >
      <Text
        text={text}
        size="xxs"
        weight="medium"
        numberOfLines={1}
        style={{ color: theme.colors.palette.neutral700 }}
      />
    </View>
  )
}

function SortControlButton({ label, active, direction, onPress }: SortControlButtonProps) {
  const { theme } = useAppTheme()
  const indicator = active ? (direction === "asc" ? "↑" : "↓") : "↕"

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => ({
        minHeight: 38,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: active
          ? theme.colors.palette.primary500
          : theme.colors.palette.neutral200,
        backgroundColor: active
          ? theme.colors.palette.primary100
          : theme.colors.palette.neutral100,
        paddingHorizontal: 10,
        paddingVertical: 8,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      <Text
        text={label}
        size="xs"
        weight="medium"
        numberOfLines={1}
        style={{
          color: active ? theme.colors.palette.primary600 : theme.colors.palette.neutral700,
        }}
      />
      <View
        style={{
          minWidth: 24,
          height: 20,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active
            ? theme.colors.palette.primary500
            : theme.colors.palette.neutral200,
          paddingHorizontal: 5,
        }}
      >
        <Text
          text={indicator}
          size="xxs"
          weight="bold"
          style={{
            color: active
              ? theme.colors.palette.neutral100
              : theme.colors.palette.neutral600,
          }}
        />
      </View>
    </Pressable>
  )
}

export function HomeFeedFilters(props: HomeFeedFiltersProps) {
  const { t } = useTranslation()
  const { theme } = useAppTheme()

  const isNearbyView = props.viewMode === "forYou"
  const allStatusesSelected =
    props.availableStatuses.length === 0 ||
    props.selectedStatuses.size === 0 ||
    props.availableStatuses.every((status) => props.selectedStatuses.has(status))

  const selectedStatusLabel = useMemo(() => {
    if (allStatusesSelected) {
      return t("oolshik:homeScreen.allStatuses")
    }

    const selectedCount = props.availableStatuses.filter((status) =>
      props.selectedStatuses.has(status),
    ).length

    if (selectedCount <= 1) {
      const firstMatch = props.availableStatuses.find((status) => props.selectedStatuses.has(status))
      if (!firstMatch) return t("oolshik:homeScreen.allStatuses")
      const labelMap: Record<HomeFeedStatus, string> = {
        OPEN: t("oolshik:status.open"),
        PENDING_AUTH: t("oolshik:status.pendingAuth"),
        ASSIGNED: t("oolshik:status.assigned"),
        WORK_DONE_PENDING_CONFIRMATION: t("oolshik:status.waitingConfirmation"),
        REVIEW_REQUIRED: t("oolshik:status.reviewRequired"),
        COMPLETED: t("oolshik:status.completed"),
        CANCELLED: t("oolshik:status.cancelled"),
      }
      return labelMap[firstMatch]
    }

    return t("oolshik:homeScreen.statusesSelectedSummary", { count: selectedCount })
  }, [allStatusesSelected, props.availableStatuses, props.selectedStatuses, t])

  const activeSortSummary =
    props.sort.key === "time"
      ? props.sort.direction === "asc"
        ? t("oolshik:homeScreen.sortNewestFirst")
        : t("oolshik:homeScreen.sortOldestFirst")
      : props.sort.direction === "asc"
        ? t("oolshik:homeScreen.sortNearestFirst")
        : t("oolshik:homeScreen.sortFarthestFirst")

  const compactPadding = props.condensed ? 8 : 10

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: props.condensed ? 6 : 10 }}>
      <SectionCard
        style={{
          paddingHorizontal: compactPadding,
          paddingVertical: compactPadding,
          borderRadius: 16,
        }}
      >
        {isNearbyView ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {[1, 2, 5].map((km) => {
                const active = props.radiusMeters === km
                return (
                  <Pressable
                    key={km}
                    onPress={() => props.onSetRadius(km as Radius)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t("oolshik:homeScreen.radiusOption", { km })}
                    style={({ pressed }) => ({
                      minHeight: 34,
                      borderRadius: 999,
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderWidth: 1,
                      borderColor: active
                        ? theme.colors.palette.primary500
                        : theme.colors.palette.neutral200,
                      backgroundColor: active
                        ? theme.colors.palette.primary500
                        : theme.colors.palette.neutral100,
                      opacity: pressed ? 0.92 : 1,
                    })}
                  >
                    <Text
                      text={t("oolshik:homeScreen.radiusOption", { km })}
                      size="xs"
                      weight="medium"
                      style={{
                        color: active
                          ? theme.colors.palette.neutral100
                          : theme.colors.palette.neutral700,
                      }}
                    />
                  </Pressable>
                )
              })}
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <SortControlButton
                  label={t("oolshik:homeScreen.sortTime")}
                  active={props.sort.key === "time"}
                  direction={props.sort.key === "time" ? props.sort.direction : "asc"}
                  onPress={() => props.onToggleSort("time")}
                />
              </View>
              <View style={{ flex: 1 }}>
                <SortControlButton
                  label={t("oolshik:homeScreen.sortDistance")}
                  active={props.sort.key === "distance"}
                  direction={props.sort.key === "distance" ? props.sort.direction : "asc"}
                  onPress={() => props.onToggleSort("distance")}
                />
              </View>
              <Pressable
                onPress={props.onToggleExpanded}
                accessibilityRole="button"
                accessibilityState={{ expanded: props.expanded }}
                accessibilityLabel={t("oolshik:homeScreen.statusControlA11y")}
                style={({ pressed }) => ({
                  minHeight: 38,
                  minWidth: 88,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.palette.neutral200,
                  backgroundColor: theme.colors.palette.neutral100,
                  justifyContent: "center",
                  paddingHorizontal: 10,
                  paddingVertical: 8,
                  opacity: pressed ? 0.92 : 1,
                })}
              >
                <Text
                  text={t("oolshik:statusFilter")}
                  size="xxs"
                  weight="bold"
                  numberOfLines={1}
                  style={{ color: theme.colors.palette.neutral700 }}
                />
                <Text
                  text={selectedStatusLabel}
                  size="xxs"
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  style={{ color: theme.colors.palette.neutral600 }}
                />
              </Pressable>
            </View>
          </>
        ) : (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              onPress={props.onToggleExpanded}
              accessibilityRole="button"
              accessibilityState={{ expanded: props.expanded }}
              accessibilityLabel={t("oolshik:homeScreen.statusControlA11y")}
              style={({ pressed }) => ({
                flex: 1.2,
                minHeight: 40,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: theme.colors.palette.primary200,
                backgroundColor: theme.colors.palette.primary100,
                justifyContent: "center",
                paddingHorizontal: 12,
                paddingVertical: 8,
                opacity: pressed ? 0.92 : 1,
              })}
            >
              <Text
                text={t("oolshik:statusFilter")}
                size="xxs"
                weight="bold"
                numberOfLines={1}
                style={{ color: theme.colors.palette.primary600 }}
              />
              <Text
                text={selectedStatusLabel}
                size="xs"
                weight="medium"
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ color: theme.colors.palette.neutral700 }}
              />
            </Pressable>

            <View style={{ flex: 1 }}>
              <SortControlButton
                label={t("oolshik:homeScreen.sortTime")}
                active
                direction={props.sort.direction}
                onPress={() => props.onToggleSort("time")}
              />
            </View>
          </View>
        )}

        {(!props.condensed || props.expanded) && (
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 6,
              marginTop: props.condensed ? 8 : 10,
            }}
          >
            <SummaryChip text={activeSortSummary} />
            {!allStatusesSelected ? <SummaryChip text={selectedStatusLabel} /> : null}
            <SummaryChip
              text={t("oolshik:homeScreen.showingCountSummary", { count: props.resultCount })}
            />
          </View>
        )}

        {props.expanded ? (
          <View
            style={{
              marginTop: 10,
              borderTopWidth: 1,
              borderTopColor: theme.colors.palette.neutral200,
              paddingTop: 10,
              gap: 8,
            }}
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
                text={t("oolshik:statusFilter")}
                size="xs"
                weight="semiBold"
                style={{ color: theme.colors.palette.neutral700 }}
              />
              {!allStatusesSelected ? (
                <Pressable
                  onPress={() => props.onSelectAllStatuses(props.availableStatuses)}
                  accessibilityRole="button"
                  style={({ pressed }) => ({
                    borderRadius: 999,
                    backgroundColor: theme.colors.palette.neutral100,
                    borderWidth: 1,
                    borderColor: theme.colors.palette.neutral200,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    opacity: pressed ? 0.92 : 1,
                  })}
                >
                  <Text
                    text={t("oolshik:homeScreen.allStatuses")}
                    size="xxs"
                    weight="medium"
                    style={{ color: theme.colors.palette.neutral700 }}
                  />
                </Pressable>
              ) : null}
            </View>

            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {props.availableStatuses.map((status) => {
                const active =
                  allStatusesSelected || props.selectedStatuses.has(status)
                return (
                  <StatusChip
                    key={status}
                    s={status}
                    active={active}
                    onPress={() => props.onToggleStatus(status)}
                  />
                )
              })}
            </View>
          </View>
        ) : null}
      </SectionCard>
    </View>
  )
}
