import React, { useCallback, useState } from "react"
import { ActivityIndicator, Pressable, RefreshControl, useWindowDimensions, View } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { useTranslation } from "react-i18next"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { SectionCard } from "@/components/SectionCard"
import { OolshikApi, type UserNotification } from "@/api/client"
import { navigateFromInboxNotification } from "@/utils/pushNotifications"
import { useAppTheme } from "@/theme/context"
import type { OolshikStackScreenProps } from "@/navigators/OolshikNavigator"

type Props = OolshikStackScreenProps<"NotificationInbox">

type State = {
  items: UserNotification[]
  page: number
  hasMore: boolean
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
}

type InboxTab = "tasks" | "admin"

function matchesTab(item: UserNotification, tab: InboxTab): boolean {
  return tab === "admin" ? item.broadcastId != null : item.broadcastId == null
}

const PAGE_SIZE = 50
const COLLAPSED_ROW_HEIGHT = 92
const STACKED_COLLAPSED_ROW_HEIGHT = 108

type NotifGroup = {
  label: string
  items: UserNotification[]
}

function groupNotifications(
  items: UserNotification[],
  t: (key: string, opts?: Record<string, unknown>) => string,
): NotifGroup[] {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000)

  const today: UserNotification[] = []
  const yesterday: UserNotification[] = []
  const earlier: UserNotification[] = []

  for (const item of items) {
    const ts = new Date(item.createdAt).getTime()
    if (ts >= todayStart.getTime()) today.push(item)
    else if (ts >= yesterdayStart.getTime()) yesterday.push(item)
    else earlier.push(item)
  }

  const groups: NotifGroup[] = []
  if (today.length > 0) groups.push({ label: t("oolshik:notificationInbox.sectionToday"), items: today })
  if (yesterday.length > 0) groups.push({ label: t("oolshik:notificationInbox.sectionYesterday"), items: yesterday })
  if (earlier.length > 0) groups.push({ label: t("oolshik:notificationInbox.sectionEarlier"), items: earlier })
  return groups
}

function formatRelativeTime(
  iso: string,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return t("oolshik:notificationInbox.timeJustNow")
  if (mins < 60) return t("oolshik:notificationInbox.timeMinAgo", { count: mins })
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return t("oolshik:notificationInbox.timeHrAgo", { count: hrs })
  const days = Math.floor(hrs / 24)
  if (days < 7) return t("oolshik:notificationInbox.timeDayAgo", { count: days })
  return new Date(iso).toLocaleDateString()
}

function NotifRow({
  item,
  isLast,
  t,
  primary500,
  neutral600,
  neutral700,
  separator,
  stackedMeta,
  expanded,
  onToggleExpanded,
}: {
  item: UserNotification
  isLast: boolean
  t: (key: string, opts?: Record<string, unknown>) => string
  primary500: string
  neutral600: string
  neutral700: string
  separator: string
  stackedMeta: boolean
  expanded: boolean
  onToggleExpanded: (id: string) => void
}) {
  const relativeTime = formatRelativeTime(item.createdAt, t)
  const collapsedHeight = stackedMeta ? STACKED_COLLAPSED_ROW_HEIGHT : COLLAPSED_ROW_HEIGHT

  return (
    <View>
      <Pressable
        onPress={() => {
          // First tap expands to reveal the full text, same as before this row
          // could deep-link. Only a second tap on an already-expanded row navigates,
          // so the inline "read more" interaction stays reachable.
          if (!expanded) {
            onToggleExpanded(item.id)
            return
          }
          const navigated = navigateFromInboxNotification({
            route: item.route,
            type: item.eventType,
            taskId: item.taskId,
            paymentRequestId: item.paymentRequestId,
          })
          if (!navigated) onToggleExpanded(item.id)
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={{
          height: expanded ? undefined : collapsedHeight,
          flexDirection: "row",
          alignItems: "flex-start",
          paddingHorizontal: 12,
          paddingVertical: 12,
          gap: 10,
          overflow: "hidden",
        }}
      >
        <View style={{ width: 10, marginTop: 4 }}>
          {!item.read && (
            <View
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: primary500,
                borderWidth: 2,
                borderColor: `${primary500}22`,
              }}
            />
          )}
        </View>

        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          {stackedMeta ? (
            <View style={{ gap: 2, minWidth: 0 }}>
              <Text
                text={item.title}
                numberOfLines={expanded ? 2 : 1}
                ellipsizeMode="tail"
                style={{
                  color: neutral700,
                  fontSize: 14,
                  fontWeight: item.read ? "400" : "600",
                  lineHeight: 19,
                }}
              />
              <Text
                text={relativeTime}
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ color: neutral600, fontSize: 11, lineHeight: 15 }}
              />
            </View>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
              <Text
                text={item.title}
                numberOfLines={expanded ? 2 : 1}
                ellipsizeMode="tail"
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: neutral700,
                  fontSize: 14,
                  fontWeight: item.read ? "400" : "600",
                  lineHeight: 19,
                }}
              />
              <Text
                text={relativeTime}
                numberOfLines={1}
                ellipsizeMode="tail"
                style={{ color: neutral600, flexShrink: 0, fontSize: 11, lineHeight: 15, maxWidth: 88 }}
              />
            </View>
          )}
          <Text
            text={item.body}
            numberOfLines={expanded ? undefined : 2}
            ellipsizeMode="tail"
            style={{ color: neutral600, fontSize: 13, lineHeight: 18 }}
          />
        </View>
      </Pressable>

      {!isLast && (
        <View style={{ height: 1, backgroundColor: separator, marginLeft: 32 }} />
      )}
    </View>
  )
}

function NotifSection({
  group,
  t,
  primary500,
  neutral600,
  neutral700,
  separator,
  textDim,
  stackedMeta,
  expandedIds,
  onToggleExpanded,
}: {
  group: NotifGroup
  t: (key: string, opts?: Record<string, unknown>) => string
  primary500: string
  neutral600: string
  neutral700: string
  separator: string
  textDim: string
  stackedMeta: boolean
  expandedIds: Set<string>
  onToggleExpanded: (id: string) => void
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text
        text={group.label}
        size="xxs"
        weight="semiBold"
        style={{ color: textDim, textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 4 }}
      />
      <SectionCard style={{ paddingVertical: 0, paddingHorizontal: 0 }}>
        {group.items.map((item, index) => (
          <NotifRow
            key={item.id}
            item={item}
            isLast={index === group.items.length - 1}
            t={t}
            primary500={primary500}
            neutral600={neutral600}
            neutral700={neutral700}
            separator={separator}
            stackedMeta={stackedMeta}
            expanded={expandedIds.has(item.id)}
            onToggleExpanded={onToggleExpanded}
          />
        ))}
      </SectionCard>
    </View>
  )
}

function EmptyState({
  t,
  primary500,
  textDim,
  tab,
}: {
  t: (key: string) => string
  primary500: string
  textDim: string
  tab: InboxTab
}) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingVertical: 48, gap: 12 }}>
      <MaterialCommunityIcons name="bell-off-outline" size={48} color={textDim} />
      <Text
        text={t("oolshik:notificationInbox.emptyTitle")}
        weight="semiBold"
        style={{ color: textDim, textAlign: "center" }}
      />
      <Text
        text={t(
          tab === "admin"
            ? "oolshik:notificationInbox.emptyBodyAdmin"
            : "oolshik:notificationInbox.emptyBodyTasks",
        )}
        size="xs"
        style={{ color: textDim, textAlign: "center", lineHeight: 20 }}
      />
    </View>
  )
}

export default function NotificationInboxScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { palette } = colors
  const { width, fontScale } = useWindowDimensions()
  const stackedMeta = width < 360 || fontScale >= 1.2

  const [state, setState] = useState<State>({
    items: [],
    page: 0,
    hasMore: true,
    loading: true,
    refreshing: false,
    loadingMore: false,
  })
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())
  const [activeTab, setActiveTab] = useState<InboxTab>("tasks")

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const load = useCallback(async (opts: { page: number; refresh?: boolean }) => {
    const { page, refresh } = opts
    if (refresh) {
      setState((s) => ({ ...s, refreshing: true }))
    } else if (page === 0) {
      setState((s) => ({ ...s, loading: true }))
    } else {
      setState((s) => ({ ...s, loadingMore: true }))
    }

    try {
      const res = await OolshikApi.getNotifications(page, PAGE_SIZE)
      if (!res.ok || !res.data) {
        setState((s) => ({ ...s, loading: false, refreshing: false, loadingMore: false }))
        return
      }

      const { content, totalPages } = res.data
      setState((s) => ({
        ...s,
        items: refresh || page === 0 ? content : [...s.items, ...content],
        page,
        hasMore: page + 1 < totalPages,
        loading: false,
        refreshing: false,
        loadingMore: false,
      }))

      if (page === 0) {
        void OolshikApi.markAllRead()
      }
    } catch {
      setState((s) => ({ ...s, loading: false, refreshing: false, loadingMore: false }))
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      void load({ page: 0 })
    }, [load]),
  )

  const tabItems = state.items.filter((item) => matchesTab(item, activeTab))
  const groups = groupNotifications(tabItems, t)

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, flexGrow: 1 }}
      ScrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={state.refreshing}
            onRefresh={() => void load({ page: 0, refresh: true })}
            tintColor={palette.primary500}
            colors={[palette.primary500]}
          />
        ),
      }}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={8}
        style={{ alignSelf: "flex-start" }}
        accessibilityRole="button"
        accessibilityLabel={t("common:back")}
      >
        <Text text={`← ${t("common:back")}`} />
      </Pressable>

      <Text
        text={t("oolshik:notificationInbox.heading")}
        preset="heading"
      />

      {state.loading && (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48 }}>
          <ActivityIndicator size="large" color={palette.primary500} />
        </View>
      )}

      {!state.loading && (
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["tasks", "admin"] as InboxTab[]).map((tab) => {
            const active = activeTab === tab
            return (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => ({
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: active ? palette.primary500 : palette.neutral200,
                  backgroundColor: active ? palette.primary100 : palette.neutral100,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text
                  text={t(
                    tab === "tasks"
                      ? "oolshik:notificationInbox.tabTasks"
                      : "oolshik:notificationInbox.tabAdmin",
                  )}
                  size="xs"
                  weight={active ? "semiBold" : "normal"}
                  style={{ color: active ? palette.primary600 : palette.neutral700 }}
                />
              </Pressable>
            )
          })}
        </View>
      )}

      {!state.loading && tabItems.length === 0 && (
        <EmptyState t={t} primary500={palette.primary500} textDim={colors.textDim} tab={activeTab} />
      )}

      {!state.loading && groups.map((group) => (
        <NotifSection
          key={group.label}
          group={group}
          t={t}
          primary500={palette.primary500}
          neutral600={palette.neutral600}
          neutral700={palette.neutral700}
          separator={colors.separator}
          textDim={colors.textDim}
          stackedMeta={stackedMeta}
          expandedIds={expandedIds}
          onToggleExpanded={toggleExpanded}
        />
      ))}

      {state.hasMore && !state.loading && state.items.length > 0 && (
        <View style={{ alignItems: "center", paddingVertical: spacing.sm }}>
          {state.loadingMore ? (
            <ActivityIndicator size="small" color={palette.primary500} />
          ) : (
            <Pressable
              onPress={() => void load({ page: state.page + 1 })}
              hitSlop={8}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              accessibilityRole="button"
            >
              <Text
                text={t("oolshik:notificationInbox.loadMore")}
                size="sm"
                style={{ color: palette.primary500 }}
              />
            </Pressable>
          )}
        </View>
      )}
    </Screen>
  )
}
