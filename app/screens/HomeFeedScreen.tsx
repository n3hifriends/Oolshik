import React, { useEffect, useMemo, useCallback, useState } from "react"
import { View, ActivityIndicator, FlatList, ListRenderItem, Pressable } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TaskCard } from "@/components/TaskCard"
import { Button } from "@/components/Button"
import { useTaskStore } from "@/store/taskStore"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { RadioGroup } from "@/components/RadioGroup"
import { colors } from "@/theme/colors"

type Radius = 1 | 2 | 5

type Status = "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELLED"

const STATUS_ORDER: Status[] = ["OPEN", "ASSIGNED", "COMPLETED", "CANCELLED"]

// Color tokens for chips (fallback hexes chosen to fit a professional theme)
const STATUS_COLORS: Record<Status, string> = {
  OPEN: "#0EA5E9", // sky-500 like
  ASSIGNED: "#F59E0B", // amber-500 like
  COMPLETED: "#10B981", // emerald-500 like
  CANCELLED: "#EF4444", // red-500 like
}

const STATUS_LABELS: Record<Status, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}

export default function HomeFeedScreen({ navigation }: any) {
  const { coords } = useForegroundLocation()
  const { tasks, fetchNearby, loading, radiusMeters, setRadius, accept } = useTaskStore()

  // Status filter (default matches previous behavior: hide Completed/Cancelled)
  const [selectedStatuses, setSelectedStatuses] = useState<Set<Status>>(
    new Set(["OPEN", "ASSIGNED"]),
  )

  const toggleStatus = (s: Status) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }

  useEffect(() => {
    if (coords) fetchNearby(coords.latitude, coords.longitude)
  }, [coords, radiusMeters])

  useFocusEffect(
    useCallback(() => {
      if (coords) {
        fetchNearby(coords.latitude, coords.longitude)
      }
      // no cleanup needed
    }, [coords?.latitude, coords?.longitude, radiusMeters]),
  )

  const data = useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : []
    // de-dupe by id (last write wins)
    const map = new Map(list.map((t) => [t.id, t]))
    const unique = Array.from(map.values())
    // filter by selected statuses
    const filtered = unique.filter((t: any) => selectedStatuses.has(t.status as Status))
    // stable order by distance then createdAt desc fallback
    return filtered.sort((a: any, b: any) => {
      const d = (a.distanceKm ?? 0) - (b.distanceKm ?? 0)
      if (d !== 0) return d
      const at = new Date(a.createdAt ?? 0).getTime()
      const bt = new Date(b.createdAt ?? 0).getTime()
      return bt - at
    })
  }, [tasks, selectedStatuses])

  const renderItem: ListRenderItem<(typeof data)[number]> = ({ item: t }) => (
    <TaskCard
      id={t.id}
      title={t.description}
      kmAway={t.distanceKm}
      status={t.status}
      voiceUrl={t.voiceUrl ? String(t.voiceUrl) : undefined}
      onAccept={
        t.status === "OPEN"
          ? async () => {
              const res = await accept(t.id)
              if (res === "ALREADY") alert("Already assigned")
              // refresh list after accepting
              if (coords) fetchNearby(coords.latitude, coords.longitude)
            }
          : undefined
      }
      onPress={async () => {
        navigation.navigate("OolshikDetail", { id: t.id })
      }}
      createdByName={t.createdByName}
      createdAt={t.createdAt}
    />
  )

  return (
    <Screen
      preset="fixed" // fixed layout; only FlatList scrolls
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ flex: 1 }} // let internal views fill height
    >
      {/* Header (fixed) */}
      <View style={{ padding: 12 }}>
        <Text preset="heading" text="Nearby Tasks" style={{ marginBottom: 12 }} />

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
        <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
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
                accessibilityLabel={`Filter ${STATUS_LABELS[s]}`}
              >
                <Text
                  style={{ fontWeight: "600", color: active ? "#ffffff" : STATUS_COLORS[s] }}
                  text={STATUS_LABELS[s]}
                />
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Scrollable list area */}
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
            extraData={{ radiusMeters, selected: Array.from(selectedStatuses).sort().join(",") }}
            refreshing={loading}
            onRefresh={() => {
              if (coords) fetchNearby(coords.latitude, coords.longitude)
            }}
            removeClippedSubviews
            contentContainerStyle={{
              paddingBottom: 120, // space for the fixed Create button
            }}
            ListEmptyComponent={<Text tx="oolshik:emptyNearby" style={{ paddingVertical: 12 }} />}
          />
        )}
      </View>

      {/* Bottom fixed Create button */}
      <View style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}>
        <Button
          text="Create"
          onPress={() => navigation.navigate("OolshikCreate")}
          style={{ width: "100%", marginBottom: 0 }}
        />
      </View>
    </Screen>
  )
}
