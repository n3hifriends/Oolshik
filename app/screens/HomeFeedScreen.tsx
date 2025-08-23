import React, { useEffect, useMemo, useCallback } from "react"
import { View, ActivityIndicator, FlatList, ListRenderItem } from "react-native"
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

export default function HomeFeedScreen({ navigation }: any) {
  const { coords } = useForegroundLocation()
  const { tasks, fetchNearby, loading, radiusMeters, setRadius, accept } = useTaskStore()

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
    // hide completed items from feed
    const openish = unique.filter((t: any) => t.status !== "COMPLETED")
    // stable order by distance then createdAt desc fallback
    return openish.sort((a: any, b: any) => {
      const d = (a.distanceKm ?? 0) - (b.distanceKm ?? 0)
      if (d !== 0) return d
      const at = new Date(a.createdAt ?? 0).getTime()
      const bt = new Date(b.createdAt ?? 0).getTime()
      return bt - at
    })
  }, [tasks])

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
            extraData={radiusMeters}
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
