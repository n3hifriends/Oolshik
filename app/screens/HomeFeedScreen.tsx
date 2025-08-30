import React, { useEffect, useMemo, useCallback, useState } from "react"
import { View, ActivityIndicator, FlatList, ListRenderItem, Pressable, Alert } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TaskCard } from "@/components/TaskCard"
import { Button } from "@/components/Button"
import { useTaskStore } from "@/store/taskStore"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { RadioGroup } from "@/components/RadioGroup"
import { colors } from "@/theme/colors"
import { useAuth } from "@/context/AuthContext"

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

const LOGOUT_COLOR = "#FF6B2C"

// NEW: view switch
type ViewMode = "forYou" | "mine"

export default function HomeFeedScreen({ navigation }: any) {
  const { coords } = useForegroundLocation()
  const { tasks, fetchNearby, loading, radiusMeters, setRadius, accept } = useTaskStore()
  const { logout, user } = useAuth() as any

  // Who am I? Try common shapes; keep it simple & resilient
  const myId: string | undefined = user?.id ?? user?.userId ?? user?.uid ?? user?.sub

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
      const owner = t?.requesterId ?? t?.createdById ?? t?.ownerId
      return owner ? String(owner) === String(myId) : false
    },
    [myId],
  )

  const data = useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : []

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
          top: 10,
          right: 12,
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: LOGOUT_COLOR,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
          shadowColor: "#000",
          shadowOpacity: 0.18,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
        hitSlop={8}
      >
        <Text text="⎋" style={{ color: "#fff", fontSize: 18, lineHeight: 18 }} />
      </Pressable>

      {/* Header */}
      <View style={{ padding: 12 }}>
        <Text
          preset="heading"
          tx={viewMode === "mine" ? "oolshik:myRequestsHeader" : "oolshik:nearbyForYouHeader"}
          style={{ marginBottom: 12 }}
        />

        {/* Segmented toggle: For You | My Requests */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: "#FFFFFF",
            borderRadius: 999,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            padding: 4,
            gap: 4,
            marginBottom: 5,
          }}
        >
          {(
            [
              { key: "forYou", tx: "oolshik:tabForYou" },
              { key: "mine", tx: "oolshik:tabMyRequests" },
            ] as const
          ).map((tab) => {
            const active = viewMode === tab.key
            return (
              <Pressable
                key={tab.key}
                onPress={() => setViewMode(tab.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={tab.key === "forYou" ? "For you" : "My requests"}
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingVertical: 5,
                  borderRadius: 999,
                  backgroundColor: active ? "#111827" : "transparent",
                }}
              >
                <Text
                  tx={tab.tx}
                  style={{ fontWeight: "700", color: active ? "#FFFFFF" : "#111827" }}
                />
              </Pressable>
            )
          })}
        </View>

        {/* Radius selector */}
        <RadioGroup
          value={radiusMeters}
          onChange={(v) => setRadius(v as Radius)}
          options={[
            { label: "1 km", value: 1 },
            { label: "2 km", value: 2 },
            { label: "5 km", value: 5 },
          ]}
          size="md"
          gap={8}
        />

        {/* Status filter chips */}
        <View style={{ marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {STATUS_ORDER.map((s) => {
            const active = selectedStatuses.has(s)
            return (
              <Pressable
                key={s}
                onPress={() => toggleStatus(s)}
                style={{
                  paddingVertical: 6,
                  paddingHorizontal: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: STATUS_COLORS[s],
                  backgroundColor: active ? STATUS_COLORS[s] : "transparent",
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Filter ${s}`}
              >
                <Text style={{ color: active ? "#ffffff" : STATUS_COLORS[s] }} tx={`status:${s}`} />
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Scrollable list */}
      <View style={{ flex: 1, paddingHorizontal: 12, backgroundColor: colors.background }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            style={{ marginBottom: 15 }}
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
            contentContainerStyle={{ paddingBottom: 120 }}
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
      <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
        <Button
          tx="oolshik:create"
          onPress={() => navigation.navigate("OolshikCreate")}
          style={{ width: "100%", marginBottom: 0 }}
        />
      </View>
    </Screen>
  )
}
