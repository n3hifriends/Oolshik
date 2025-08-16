import React, { useEffect, useMemo } from "react"
import { View, ActivityIndicator, FlatList, ListRenderItem } from "react-native"
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
  const { tasks, fetchNearby, loading, radiusKm, setRadius, accept } = useTaskStore()

  useEffect(() => {
    if (coords) fetchNearby(coords.latitude, coords.longitude)
  }, [coords, radiusKm])

  const data = useMemo(() => tasks ?? [], [tasks])

  const renderItem: ListRenderItem<(typeof data)[number]> = ({ item: t }) => (
    <TaskCard
      key={t.id}
      id={t.id}
      title={t.description}
      kmAway={t.distanceKm}
      status={t.status}
      voiceUrl={t.voiceUrl ? String(t.voiceUrl) : undefined}
      onAccept={async () => {
        const res = await accept(t.id)
        if (res === "ALREADY") alert("Already assigned")
      }}
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
          value={radiusKm}
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
