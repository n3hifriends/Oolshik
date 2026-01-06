import React, { useCallback, useMemo, useRef, useState } from "react"
import {
  View,
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  Alert,
  TextInput,
} from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TaskCard } from "@/components/TaskCard"
import { Button } from "@/components/Button"
import { useTaskStore } from "@/store/taskStore"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { colors } from "@/theme/colors"
import { useAuth } from "@/context/AuthContext"
import { SectionCard } from "@/components/SectionCard"
import { Segmented, ViewMode } from "@/components/Segmented"
import { Pill } from "@/components/Pill"
import { StatusChip } from "@/components/StatusChip"
import { ExpandableSearch } from "@/components/ExpandableSearch"
import { useTaskFiltering, Status } from "@/hooks/useTaskFiltering"
import { getDistanceMeters } from "@/utils/distance"
import { SpotlightComposer } from "@/components/SpotlightComposer"

type Radius = 1 | 2 | 5
const STATUS_ORDER: Status[] = ["OPEN", "ASSIGNED", "COMPLETED", "CANCELLED"]
const LOGOUT_COLOR = "#FF6B2C"

export default function HomeFeedScreen({ navigation }: any) {
  const { coords } = useForegroundLocation()
  const { tasks, fetchNearby, loading, radiusMeters, setRadius, accept } = useTaskStore()
  const { logout, userId } = useAuth()

  const [selectedStatuses, setSelectedStatuses] = useState<Set<Status>>(
    new Set(["OPEN", "ASSIGNED"]),
  )
  const [viewMode, setViewMode] = useState<ViewMode>("forYou")

  // search
  const [searchOpen, setSearchOpen] = useState(false)
  const [rawSearch, setRawSearch] = useState("")
  const searchInputRef = useRef<TextInput>(null)

  const { filtered, setQuery } = useTaskFiltering(tasks, {
    selectedStatuses,
    viewMode,
    myId: userId,
    rawQuery: rawSearch,
  })

  const toggleStatus = (s: Status) =>
    setSelectedStatuses((prev) => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })

  useFocusEffect(
    useCallback(() => {
      if (coords) {
        const statusesArg = selectedStatuses.size ? Array.from(selectedStatuses) : undefined
        fetchNearby(coords.latitude, coords.longitude, statusesArg as any)
      }
    }, [coords?.latitude, coords?.longitude, radiusMeters, selectedStatuses]),
  )

  const onAcceptPress = async (taskId: string) => {
    if (!coords) {
      alert("Location not available")
      return
    }
    const res = await accept(taskId, coords.latitude, coords.longitude)
    if (res != "OK") {
      alert("Failed to accept")
      return
    }

    // refresh nearby list so UI reflects ASSIGNED
    if (coords) {
      // reuse your existing fetchNearby
      await fetchNearby(coords.latitude, coords.longitude)
    }
  }

  const renderItem: ListRenderItem<any> = useCallback(
    ({ item: t }) => (
      <TaskCard
        id={t.id}
        title={t.title}
        distanceMtr={getDistanceMeters(t)}
        status={t.status}
        voiceUrl={t.voiceUrl ? String(t.voiceUrl) : undefined}
        onAccept={
          viewMode === "forYou" && t.status === "OPEN"
            ? async () => {
                await onAcceptPress(t.id)
              }
            : undefined
        }
        onPress={() => navigation.navigate("OolshikDetail", { id: t.id })}
        createdByName={t.createdByName ?? t.requesterName}
        createdAt={t.createdAt}
        helperAvgRating={t.helperAvgRating}
      />
    ),
    [accept, coords, fetchNearby, navigation, viewMode],
  )

  const handleSubmitTask = useCallback(async (value: string, mode: "voice" | "type") => {
    console.log("Submitted task", value, mode)
  }, [])

  // return (
  //   <Screen preset="fixed" safeAreaEdges={["top", "bottom"]} contentContainerStyle={{ flex: 1 }}>
  //       <SpotlightComposer onSubmitTask={handleSubmitTask} />
  //   </Screen>
  // )

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]} contentContainerStyle={{ flex: 1 }}>
      <SpotlightComposer onSubmitTask={handleSubmitTask} />

      <Pressable
        onPress={() =>
          Alert.alert("Logout", "Are you sure you want to logout?", [
            { text: "Cancel", style: "cancel" },
            { text: "Logout", style: "destructive", onPress: () => logout() },
          ])
        }
        accessibilityRole="button"
        accessibilityLabel="Logout"
        style={({ pressed }) => ({
          position: "absolute",
          top: 8,
          right: 12,
          width: 30,
          height: 30,
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
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {/* {!searchOpen && (
            <Text
              preset="heading"
              tx={viewMode === "mine" ? "oolshik:myRequestsHeader" : "oolshik:nearbyForYouHeader"}
              style={{ marginBottom: 12, flex: 1 }}
            />
          )} */}
          <ExpandableSearch
            open={searchOpen}
            setOpen={(v) => {
              setSearchOpen(v)
              if (!v) {
                setRawSearch("")
                setQuery("")
              }
            }}
            value={rawSearch}
            onChangeText={(t) => {
              setRawSearch(t)
              setQuery(t)
            }}
            onClear={() => {
              setRawSearch("")
              setQuery("")
            }}
            inputRef={searchInputRef as React.RefObject<TextInput>}
          />
        </View>

        <Segmented value={viewMode} onChange={setViewMode} />
      </View>

      {/* Filters */}
      <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
        <SectionCard>
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

          <View style={{ height: 12 }} />

          <Text tx="oolshik:statusFilter" style={{ marginBottom: 8, color: "#6B7280" }} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {STATUS_ORDER.map((s) => {
              const active = selectedStatuses.has(s)
              return (
                <StatusChip key={s} s={s as any} active={active} onPress={() => toggleStatus(s)} />
              )
            })}
          </View>
        </SectionCard>
      </View>

      {/* List */}
      <View style={{ flex: 1, paddingHorizontal: 16, backgroundColor: colors.background }}>
        {loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            style={{ marginBottom: 16 }}
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews
            refreshing={loading}
            onRefresh={() => {
              if (coords) {
                const statusesArg = selectedStatuses.size ? Array.from(selectedStatuses) : undefined
                fetchNearby(coords.latitude, coords.longitude, statusesArg as any)
              }
            }}
            contentContainerStyle={{ paddingBottom: 140 }}
            ListEmptyComponent={
              <Text
                tx={viewMode === "mine" ? "oolshik:emptyMine" : "oolshik:emptyForYou"}
                style={{ paddingVertical: 12 }}
              />
            }
            extraData={{
              radiusMeters,
              selected: Array.from(selectedStatuses).sort().join(","),
              viewMode,
              rawSearch,
            }}
          />
        )}
      </View>

      {/* Create */}
      <View style={{ position: "absolute", left: 16, right: 16, bottom: 0 }}>
        <View style={{ flex: 1, flexDirection: "row", justifyContent: "center" }}>
          <View style={{ flex: 0.5, flexDirection: "row", justifyContent: "center" }}></View>
          <View style={{ flex: 0.5, flexDirection: "row", justifyContent: "center" }}>
            <Button
              tx="oolshik:create"
              onPress={() => navigation.navigate("OolshikCreate")}
              style={{ width: "100%", marginBottom: 0 }}
            />
          </View>
        </View>
      </View>
    </Screen>
  )
}
