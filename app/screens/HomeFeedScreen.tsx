import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  View,
  ActivityIndicator,
  FlatList,
  ListRenderItem,
  Pressable,
  Alert,
  TextInput,
  Linking,
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
import { getProfileExtras } from "@/features/profile/storage/profileExtrasStore"
import { SectionCard } from "@/components/SectionCard"
import { Segmented, ViewMode } from "@/components/Segmented"
import { Pill } from "@/components/Pill"
import { StatusChip } from "@/components/StatusChip"
import { ExpandableSearch } from "@/components/ExpandableSearch"
import { useTaskFiltering, Status } from "@/hooks/useTaskFiltering"
import { getDistanceMeters } from "@/utils/distance"
import { SpotlightComposer } from "@/components/SpotlightComposer"
import { OolshikApi } from "@/api"
import { uploadAudioSmart } from "@/audio/uploadAudio"

type Radius = 1 | 2 | 5
const STATUS_ORDER: Status[] = ["OPEN", "PENDING_AUTH", "ASSIGNED", "COMPLETED", "CANCELLED"]
const TITLE_REFRESH_COOLDOWN_MS = 5000
const RADIUS_OPTIONS: Radius[] = [1, 2, 5]
const normalizeStatus = (status?: string): Status | null => {
  const raw = String(status ?? "").trim().toUpperCase()
  if (!raw) return null
  if (raw === "PENDING") return "OPEN"
  if (raw === "CANCELED") return "CANCELLED"
  if (
    raw === "OPEN" ||
    raw === "PENDING_AUTH" ||
    raw === "ASSIGNED" ||
    raw === "COMPLETED" ||
    raw === "CANCELLED"
  ) {
    return raw as Status
  }
  return null
}
const normalizeRadius = (value?: number | null): Radius => {
  if (value && RADIUS_OPTIONS.includes(value as Radius)) return value as Radius
  if (!value) return 1
  return RADIUS_OPTIONS.reduce((closest, current) =>
    Math.abs(current - value) < Math.abs(closest - value) ? current : closest,
  )
}

function getInitials(name?: string, fallback?: string) {
  const source = (name || fallback || "").trim()
  if (!source) return "U"
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

export default function HomeFeedScreen({ navigation }: any) {
  const { coords, status, error: locationError, refresh } = useForegroundLocation()
  const { tasks, fetchNearby, loading, radiusMeters, setRadius, accept } = useTaskStore()
  const { logout, userId, userName, authEmail } = useAuth()
  const lastFetchKeyRef = useRef<string | null>(null)
  const suppressNextFetchRef = useRef(false)
  const userTouchedStatusesRef = useRef(false)
  const selectedStatusesRef = useRef<Set<Status>>(new Set())

  const [selectedStatuses, setSelectedStatuses] = useState<Set<Status>>(new Set())
  const [viewMode, setViewMode] = useState<ViewMode>("forYou")
  const [creatingTask, setCreatingTask] = useState(false)
  const [preferredRadiusKm, setPreferredRadiusKm] = useState<number | null>(null)
  const profileInitials = useMemo(
    () => getInitials(userName && userName !== "You" ? userName : undefined, authEmail ?? ""),
    [authEmail, userName],
  )

  const [titleRefreshCooldowns, setTitleRefreshCooldowns] = useState<Record<string, number>>({})
  const titleRefreshTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // search
  const [searchOpen, setSearchOpen] = useState(false)
  const [rawSearch, setRawSearch] = useState("")
  const searchInputRef = useRef<TextInput>(null)

  const sortedStatuses = useMemo(() => Array.from(selectedStatuses).sort(), [selectedStatuses])
  const statusesKey = useMemo(() => sortedStatuses.join(","), [sortedStatuses])
  useEffect(() => {
    selectedStatusesRef.current = selectedStatuses
  }, [selectedStatuses])

  const { filtered, setQuery } = useTaskFiltering(tasks, {
    selectedStatuses,
    viewMode,
    myId: userId,
    rawQuery: rawSearch,
  })

  useEffect(() => {
    return () => {
      titleRefreshTimersRef.current.forEach((timer) => clearTimeout(timer))
      titleRefreshTimersRef.current.clear()
    }
  }, [])

  useEffect(() => {
    let active = true
    getProfileExtras()
      .then((extras) => {
        if (!active) return
        setPreferredRadiusKm(extras.helperRadiusKm ?? null)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const toggleStatus = (s: Status) =>
    setSelectedStatuses((prev) => {
      userTouchedStatusesRef.current = true
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })

  useEffect(() => {
    userTouchedStatusesRef.current = false
    if (selectedStatusesRef.current.size === 0) return
    suppressNextFetchRef.current = true
    setSelectedStatuses(new Set())
  }, [viewMode])

  useFocusEffect(
    useCallback(() => {
      refresh()
    }, [refresh]),
  )

  useFocusEffect(
    useCallback(() => {
      if (status !== "ready" || !coords) return
      const statusesArg = userTouchedStatusesRef.current
        ? sortedStatuses
        : undefined
      const key = [
        coords.latitude.toFixed(5),
        coords.longitude.toFixed(5),
        radiusMeters,
        userTouchedStatusesRef.current ? statusesKey : "auto",
      ].join("|")
      if (suppressNextFetchRef.current) {
        suppressNextFetchRef.current = false
        lastFetchKeyRef.current = key
        return
      }
      if (lastFetchKeyRef.current === key) return
      lastFetchKeyRef.current = key
      fetchNearby(coords.latitude, coords.longitude, statusesArg as any)
    }, [
      status,
      coords?.latitude,
      coords?.longitude,
      radiusMeters,
      statusesKey,
      fetchNearby,
      sortedStatuses,
    ]),
  )

  const availableStatuses = useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : []
    const unique = Array.from(new Map(list.map((t: any) => [t.id, t])).values())
    const mine = (t: any) =>
      userId ? String(t?.requesterId) === String(userId) : false

    let res = unique.filter((t: any) => (viewMode === "mine" ? mine(t) : !mine(t)))
    res = res.filter((t: any) => {
      if (t?.status !== "PENDING_AUTH") return true
      if (viewMode === "mine") return true
      return userId ? String(t?.pendingHelperId) === String(userId) : false
    })

    const set = new Set<Status>()
    res.forEach((t: any) => {
      const normalized = normalizeStatus(t?.status)
      if (normalized) set.add(normalized)
    })
    return STATUS_ORDER.filter((s) => set.has(s))
  }, [tasks, userId, viewMode])

  useEffect(() => {
    if (userTouchedStatusesRef.current) return
    if (loading) return
    if (!tasks || tasks.length === 0) return
    if (selectedStatuses.size > 0) return
    if (availableStatuses.length === 0) return

    suppressNextFetchRef.current = true
    setSelectedStatuses(new Set(availableStatuses))
  }, [availableStatuses, loading, selectedStatuses.size, tasks])

  const onAcceptPress = async (taskId: string) => {
    if (!coords) {
      refresh()
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

  const isTitleRefreshCooling = useCallback(
    (taskId: string) => {
      const until = titleRefreshCooldowns[taskId]
      return typeof until === "number" && until > Date.now()
    },
    [titleRefreshCooldowns],
  )

  const scheduleTitleRefreshCooldown = useCallback((taskId: string) => {
    const until = Date.now() + TITLE_REFRESH_COOLDOWN_MS
    setTitleRefreshCooldowns((prev) => ({ ...prev, [taskId]: until }))

    const existing = titleRefreshTimersRef.current.get(taskId)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      setTitleRefreshCooldowns((prev) => {
        if (!(taskId in prev)) return prev
        const next = { ...prev }
        delete next[taskId]
        return next
      })
      titleRefreshTimersRef.current.delete(taskId)
    }, TITLE_REFRESH_COOLDOWN_MS)

    titleRefreshTimersRef.current.set(taskId, timer)
  }, [])

  const refreshTitleForTask = useCallback(
    async (taskId: string) => {
      if (loading) return
      if (status !== "ready" || !coords) {
        refresh()
        Alert.alert("Location not available", "Enable location and try again.")
        return
      }
      if (isTitleRefreshCooling(taskId)) return

      scheduleTitleRefreshCooldown(taskId)
      const statusesArg = sortedStatuses.length ? sortedStatuses : undefined
      try {
        await fetchNearby(coords.latitude, coords.longitude, statusesArg as any)
      } catch {
        // best-effort refresh
      }
    },
    [
      coords,
      fetchNearby,
      isTitleRefreshCooling,
      loading,
      refresh,
      scheduleTitleRefreshCooldown,
      sortedStatuses,
      status,
    ],
  )

  const renderItem: ListRenderItem<any> = useCallback(
    ({ item: t }) => {
      const titleText = typeof t.title === "string" ? t.title.trim() : ""
      const needsTitleRefresh = titleText === "..."
      const titleRefreshDisabled = needsTitleRefresh && (loading || isTitleRefreshCooling(t.id))
      const avgRating =
        userId && t.requesterId && t.requesterId === userId
          ? (t.helperAvgRating ?? null)
          : (t.requesterAvgRating ?? null)

      return (
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
          onTitleRefresh={needsTitleRefresh ? () => refreshTitleForTask(t.id) : undefined}
          titleRefreshDisabled={titleRefreshDisabled}
          onPress={() => navigation.navigate("OolshikDetail", { id: t.id })}
          createdByName={t.createdByName ?? t.requesterName}
          createdAt={t.createdAt}
          avgRating={avgRating}
        />
      )
    },
    [
      isTitleRefreshCooling,
      loading,
      navigation,
      onAcceptPress,
      refreshTitleForTask,
      userId,
      viewMode,
    ],
  )

  const handleSubmitTask = useCallback(
    async ({
      text,
      mode,
      voiceNote,
    }: {
      text: string
      mode: "voice" | "type"
      voiceNote?: { filePath: string; durationSec: number }
    }) => {
      const title = text.trim()
      const isVoice = mode === "voice"
      if (!title) {
        throw new Error("Please enter a title.")
      }
      if (!coords) {
        refresh()
        throw new Error("Location not available. Please enable location and try again.")
      }
      if (isVoice && !voiceNote) {
        throw new Error("Recording not found. Please record again.")
      }
      if (creatingTask) {
        throw new Error("Already submitting, please wait.")
      }

      const uploadVoiceIfNeeded = async () => {
        if (!voiceNote) return undefined
        const res = await uploadAudioSmart({
          uri: voiceNote.filePath,
          filename: `voice_${Date.now()}.m4a`,
          mimeType: "audio/m4a",
          durationMs: voiceNote.durationSec * 1000,
        })
        if (!res.ok) {
          throw new Error("Upload failed. Please try again.")
        }
        return res.url
      }

      const effectiveRadiusKm =
        preferredRadiusKm != null ? normalizeRadius(preferredRadiusKm) : radiusMeters

      setCreatingTask(true)
      try {
        const voiceUrl = await uploadVoiceIfNeeded()
        const payload = {
          title,
          description: undefined, // extend when composer provides description/audio
          voiceUrl,
          latitude: coords.latitude,
          longitude: coords.longitude,
          radiusMeters: effectiveRadiusKm * 1000,
          createdById: userId,
          createdByName: userName,
          createdAt: new Date().toISOString(),
        }

        const res = await OolshikApi.createTask(payload)
        if (!res.ok || !res.data) {
          const errMsg =
            (res as any)?.data?.message ||
            (res as any)?.problem ||
            (res as any)?.originalError?.message ||
            "Please try again."
          throw new Error(errMsg)
        }

        // Refresh nearby feed so the new task appears
        try {
          await fetchNearby(coords.latitude, coords.longitude)
        } catch {
          // best-effort refresh; no need to block success
        }
      } finally {
        setCreatingTask(false)
      }
    },
    [coords, creatingTask, fetchNearby, preferredRadiusKm, radiusMeters, refresh, userId, userName],
  )

  const onOpenSettings = useCallback(async () => {
    try {
      await Linking.openSettings()
    } catch {
      Alert.alert("Unable to open settings", "Please open Settings and enable location access.")
    }
  }, [])

  const renderLocationState = () => {
    if (status === "loading" || status === "idle") {
      return (
        <View style={{ paddingVertical: 24, alignItems: "center", gap: 8 }}>
          <ActivityIndicator />
          <Text text="Getting your location…" />
        </View>
      )
    }
    if (status === "denied") {
      return (
        <View style={{ paddingVertical: 24, gap: 12 }}>
          <Text text="Location permission denied" preset="heading" />
          <Text text="Enable location to see nearby tasks." />
          <Button text="Open Settings" onPress={onOpenSettings} />
        </View>
      )
    }
    if (status === "error") {
      return (
        <View style={{ paddingVertical: 24, gap: 12 }}>
          <Text text="Could not access location" preset="heading" />
          <Text text={locationError ?? "Please try again."} />
          <Button text="Retry" onPress={refresh} />
        </View>
      )
    }
    return null
  }

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
            {
              text: "Logout",
              style: "destructive",
              onPress: () => {
                logout()
              },
            },
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
          backgroundColor: colors.palette.primary500,
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
        <View
          style={{
            flexDirection: "row",
            alignItems: searchOpen ? "flex-start" : "center",
            gap: 10,
          }}
        >
          <Pressable
            onPress={() => navigation.navigate("OolshikProfile")}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            hitSlop={8}
            style={{
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: colors.palette.primary500,
              alignItems: "center",
              justifyContent: "center",
              marginTop: searchOpen ? 8 : 0,
            }}
          >
            <Text text={profileInitials} style={{ color: "#fff", fontWeight: "700" }} />
          </Pressable>
          {/* {!searchOpen && (
            <Text
              preset="heading"
              tx={viewMode === "mine" ? "oolshik:myRequestsHeader" : "oolshik:nearbyForYouHeader"}
              style={{ marginBottom: 12, flex: 1 }}
            />
          )} */}
          <View style={{ flex: 1 }}>
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
                onPress={() => {
                  setRadius(km as Radius)
                }}
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
        {status !== "ready" ? (
          renderLocationState()
        ) : loading ? (
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
              if (status !== "ready" || !coords) {
                refresh()
                return
              }
              const statusesArg = sortedStatuses.length ? sortedStatuses : undefined
              fetchNearby(coords.latitude, coords.longitude, statusesArg as any)
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
