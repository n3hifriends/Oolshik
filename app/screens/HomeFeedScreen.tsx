import React, { useEffect, useMemo, useCallback, useState } from "react"
import { View, ActivityIndicator, FlatList, ListRenderItem, Pressable, Alert } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TaskCard } from "@/components/TaskCard"
import { Button } from "@/components/Button"
import { useTaskStore } from "@/store/taskStore"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
// import { RadioGroup } from "@/components/RadioGroup" // removed – custom pills look cleaner
import { colors } from "@/theme/colors"
import { useAuth } from "@/context/AuthContext"

/**
 * HomeFeedScreen – refreshed UI
 * - Cleaner "segmented" header for For You | My Requests
 * - Card-like filter bar with Distance pills + Status chips
 * - Calmer colors and spacing for industry-standard feel
 * - No new deps; pure RN + existing components
 */

// Distances (km)
type Radius = 1 | 2 | 5

// Backend statuses
type Status = "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELLED"

const STATUS_ORDER: Status[] = ["OPEN", "ASSIGNED", "COMPLETED", "CANCELLED"]

// Chip colors
const STATUS_COLORS: Record<Status, string> = {
  OPEN: "#0EA5E9",
  ASSIGNED: "#F59E0B",
  COMPLETED: "#10B981",
  CANCELLED: "#EF4444",
}

const STATUS_BG: Record<Status, string> = {
  OPEN: "rgba(14,165,233,0.10)",
  ASSIGNED: "rgba(245,158,11,0.10)",
  COMPLETED: "rgba(16,185,129,0.10)",
  CANCELLED: "rgba(239,68,68,0.12)",
}

const LOGOUT_COLOR = "#FF6B2C"

// NEW: view switch
type ViewMode = "forYou" | "mine"

export default function HomeFeedScreen({ navigation }: any) {
  const { coords } = useForegroundLocation()
  const { tasks, fetchNearby, loading, radiusMeters, setRadius, accept } = useTaskStore()
  const { logout, user } = useAuth() as any

  // Who am I? Try common shapes; keep it simple & resilient
  // const myId: string | undefined = user?.id ?? user?.userId ?? user?.uid ?? user?.sub
  const myId: string | undefined = user?.id

  // Status filter (default = OPEN + ASSIGNED)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<Status>>(
    new Set(["OPEN", "ASSIGNED"]),
  )

  // NEW: tab to switch between "For You" (not mine) and "My Requests"
  const [viewMode, setViewMode] = useState<ViewMode>("forYou")

  const toggleStatus = (s: Status) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  useFocusEffect(
    useCallback(() => {
      if (coords) {
        const statusesArg = selectedStatuses.size ? Array.from(selectedStatuses) : undefined
        // If none selected, omit the statuses argument so backend returns all
        fetchNearby(coords.latitude, coords.longitude, statusesArg as any)
      }
    }, [coords?.latitude, coords?.longitude, radiusMeters, selectedStatuses]),
  )

  // Utility: is this task created by me?
  const isMine = useCallback(
    (t: any) => {
      if (!myId) return false
      // const owner = t?.requesterId ?? t?.createdById ?? t?.ownerId
      const owner = t?.requesterId
      return owner ? String(owner) === String(myId) : false
    },
    [myId],
  )

  const data = useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : []
    console.log("🚀 ~ HomeFeedScreen ~ tasks:", tasks)

    // de-dupe by id
    const unique = Array.from(new Map(list.map((t: any) => [t.id, t])).values())

    // If none selected, include all statuses present in the response
    const statusesToUse: Status[] =
      selectedStatuses.size === 0
        ? (Array.from(new Set(unique.map((t: any) => t.status))).filter(Boolean) as Status[])
        : (Array.from(selectedStatuses) as Status[])

    // Filter by status
    let filtered = unique.filter((t: any) => statusesToUse.includes(t.status as Status))

    // Filter by view mode
    filtered = filtered.filter((t: any) => (viewMode === "mine" ? isMine(t) : !isMine(t)))

    // Sort: nearest first, then newest
    return filtered.sort((a: any, b: any) => {
      const d = (a.distanceKm ?? 0) - (b.distanceKm ?? 0)
      if (d !== 0) return d
      const at = new Date(a.createdAt ?? 0).getTime()
      const bt = new Date(b.createdAt ?? 0).getTime()
      return bt - at
    })
  }, [tasks, selectedStatuses, viewMode, isMine])

  // ---------- Small UI building blocks ----------

  const SectionCard: React.FC<{ children: React.ReactNode; style?: any }> = ({
    children,
    style,
  }) => (
    <View
      style={[
        {
          backgroundColor: "#fff",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#ECECEC",
          padding: 12,
          shadowColor: "#000",
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 1,
        },
        style,
      ]}
    >
      {children}
    </View>
  )

  const Segmented: React.FC<{
    value: ViewMode
    onChange: (v: ViewMode) => void
  }> = ({ value, onChange }) => {
    const tabs: { key: ViewMode; tx: string; a11y: string }[] = [
      { key: "forYou", tx: "oolshik:tabForYou", a11y: "For you" },
      { key: "mine", tx: "oolshik:tabMyRequests", a11y: "My requests" },
    ]
    return (
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#F5F6F7",
          borderRadius: 12,
          padding: 4,
          gap: 4,
        }}
      >
        {tabs.map((t) => {
          const active = value === t.key
          return (
            <Pressable
              key={t.key}
              onPress={() => onChange(t.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.a11y}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 10,
                borderRadius: 10,
                backgroundColor: active ? "#111827" : "transparent",
              }}
            >
              <Text tx={t.tx} style={{ fontWeight: "700", color: active ? "#fff" : "#111827" }} />
            </Pressable>
          )
        })}
      </View>
    )
  }

  const Pill: React.FC<{
    label: string
    active?: boolean
    onPress?: () => void
    dotColor?: string
  }> = ({ label, active, onPress, dotColor = "#FF6B2C" }) => (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? "#111827" : "#F2F4F7",
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: active ? "#fff" : dotColor,
          opacity: active ? 1 : 0.8,
        }}
      />
      <Text style={{ color: active ? "#fff" : "#111827", fontWeight: "600" }} text={label} />
    </Pressable>
  )

  const StatusChip: React.FC<{ s: Status; active: boolean; onPress: () => void }> = ({
    s,
    active,
    onPress,
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`Filter ${s}`}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: STATUS_COLORS[s],
        backgroundColor: active ? STATUS_COLORS[s] : STATUS_BG[s],
      }}
    >
      <Text tx={`status:${s}`} style={{ color: active ? "#fff" : STATUS_COLORS[s] }} />
    </Pressable>
  )

  const renderItem: ListRenderItem<(typeof data)[number]> = ({ item: t }) => (
    <TaskCard
      id={t.id}
      title={t.title}
      kmAway={t.distanceKm}
      status={t.status}
      voiceUrl={t.voiceUrl ? String(t.voiceUrl) : undefined}
      onAccept={
        viewMode === "forYou" && t.status === "OPEN"
          ? async () => {
              const res = await accept(t.id)
              if (res === "ALREADY") alert("Already assigned")
              if (coords) fetchNearby(coords.latitude, coords.longitude)
            }
          : undefined
      }
      onPress={async () => {
        navigation.navigate("OolshikDetail", { id: t.id })
      }}
      createdByName={t.createdByName ?? t.requesterName}
      createdAt={t.createdAt}
    />
  )

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]} contentContainerStyle={{ flex: 1 }}>
      {/* Floating Logout */}
      <Pressable
        onPress={() => {
          Alert.alert(
            "Logout",
            "Are you sure you want to logout?",
            [
              { text: "Cancel", style: "cancel" },
              { text: "Logout", style: "destructive", onPress: () => logout() },
            ],
            { cancelable: true },
          )
        }}
        accessibilityRole="button"
        accessibilityLabel="Logout"
        style={({ pressed }) => ({
          position: "absolute",
          top: 12,
          right: 12,
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: LOGOUT_COLOR,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          shadowColor: "#000",
          shadowOpacity: 0.14,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 5,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
        hitSlop={8}
      >
        <Text text="⎋" style={{ color: "#fff", fontSize: 18, lineHeight: 18 }} />
      </Pressable>

      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
        <Text
          preset="heading"
          tx={viewMode === "mine" ? "oolshik:myRequestsHeader" : "oolshik:nearbyForYouHeader"}
          style={{ marginBottom: 12 }}
        />

        {/* Segmented toggle */}
        <Segmented value={viewMode} onChange={setViewMode} />
      </View>

      {/* Filters Card */}
      <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
        <SectionCard>
          {/* Distance */}
          <Text tx="oolshik:distanceFilter" style={{ marginBottom: 8, color: "#6B7280" }} />
          <View style={{ flexDirection: "row", gap: 10 }}>
            {[1, 2, 5].map((km) => (
              <Pill
                key={km}
                label={`${km} km`}
                active={radiusMeters === km}
                onPress={() => setRadius(km as Radius)}
              />
            ))}
          </View>

          {/* Divider */}
          <View style={{ height: 12 }} />

          {/* Status */}
          <Text tx="oolshik:statusFilter" style={{ marginBottom: 8, color: "#6B7280" }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {STATUS_ORDER.map((s) => {
              const active = selectedStatuses.has(s)
              return <StatusChip key={s} s={s} active={active} onPress={() => toggleStatus(s)} />
            })}
          </View>
        </SectionCard>
      </View>

      {/* Scrollable list */}
      <View style={{ flex: 1, paddingHorizontal: 16, backgroundColor: colors.background }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            style={{ marginBottom: 16 }}
            data={data}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            extraData={{
              radiusMeters,
              selected: Array.from(selectedStatuses).sort().join(","),
              viewMode,
            }}
            refreshing={loading}
            onRefresh={() => {
              if (coords) {
                const statusesArg = selectedStatuses.size ? Array.from(selectedStatuses) : undefined
                fetchNearby(coords.latitude, coords.longitude, statusesArg as any)
              }
            }}
            removeClippedSubviews
            contentContainerStyle={{ paddingBottom: 140 }}
            ListEmptyComponent={
              <Text
                tx={viewMode === "mine" ? "oolshik:emptyMine" : "oolshik:emptyForYou"}
                style={{ paddingVertical: 12 }}
              />
            }
          />
        )}
      </View>

      {/* Bottom fixed Create button */}
      <View style={{ position: "absolute", left: 16, right: 16, bottom: 0 }}>
        <Button
          tx="oolshik:create"
          onPress={() => navigation.navigate("OolshikCreate")}
          style={{ width: "100%", marginBottom: 0 }}
        />
      </View>
    </Screen>
  )
}
