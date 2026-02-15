import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, Linking, TextInput } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { useAppTheme } from "@/theme/context"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { useTaskStore } from "@/store/taskStore"
import { useAuth } from "@/context/AuthContext"
import { useTaskFiltering } from "@/hooks/useTaskFiltering"
import { getDistanceMeters } from "@/utils/distance"
import { kmDistance } from "@/utils/haversine"
import { TaskCard } from "@/components/TaskCard"
import type { OolshikStackScreenProps } from "@/navigators/OolshikNavigator"
import {
  getInitials,
  normalizeRadius,
  normalizeStatus,
  STATUS_ORDER,
  TITLE_REFRESH_COOLDOWN_MS,
} from "@/screens/home-feed/helpers/homeFeedFormatters"
import {
  createTask,
  loadPreferredRadiusKm,
  syncHelperLocation,
  uploadVoiceNote,
} from "@/screens/home-feed/requesters/homeFeedRequester"
import type {
  HomeFeedStatus,
  HomeFeedTask,
  HomeFeedViewMode,
  Radius,
  SubmitTaskInput,
  TranslateFn,
} from "@/screens/home-feed/types"

type Navigation = OolshikStackScreenProps<"OolshikHome">["navigation"]

export function useHomeFeedController({
  navigation,
  t,
}: {
  navigation: Navigation
  t: TranslateFn
}) {
  const { theme } = useAppTheme()
  const { colors: themeColors, spacing, isDark } = theme

  const { coords, status, error: locationError, refresh } = useForegroundLocation()
  const { tasks, fetchNearby, loading, radiusMeters, setRadius, accept } = useTaskStore()
  const { logout, userId, userName, authEmail } = useAuth()

  const taskItems = tasks as HomeFeedTask[]

  const lastFetchKeyRef = useRef<string | null>(null)
  const suppressNextFetchRef = useRef(false)
  const userTouchedStatusesRef = useRef(false)
  const selectedStatusesRef = useRef<Set<HomeFeedStatus>>(new Set())

  const [selectedStatuses, setSelectedStatuses] = useState<Set<HomeFeedStatus>>(new Set())
  const [viewMode, setViewMode] = useState<HomeFeedViewMode>("forYou")
  const [creatingTask, setCreatingTask] = useState(false)
  const [preferredRadiusKm, setPreferredRadiusKm] = useState<number | null>(null)

  const profileInitials = useMemo(
    () => getInitials(userName && userName !== "You" ? userName : undefined, authEmail ?? ""),
    [authEmail, userName],
  )

  const profileTextColor = isDark ? themeColors.palette.neutral100 : "#fff"

  const [titleRefreshCooldowns, setTitleRefreshCooldowns] = useState<Record<string, number>>({})
  const titleRefreshTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const lastLocationSyncRef = useRef<{ latitude: number; longitude: number; at: number } | null>(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [rawSearch, setRawSearch] = useState("")
  const searchInputRef = useRef<TextInput>(null)

  const sortedStatuses = useMemo(() => Array.from(selectedStatuses).sort(), [selectedStatuses])
  const statusesKey = useMemo(() => sortedStatuses.join(","), [sortedStatuses])

  useEffect(() => {
    selectedStatusesRef.current = selectedStatuses
  }, [selectedStatuses])

  const { filtered, setQuery } = useTaskFiltering(taskItems, {
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
    loadPreferredRadiusKm()
      .then((storedRadiusKm) => {
        if (!active) return
        setPreferredRadiusKm(storedRadiusKm)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [])

  const toggleStatus = useCallback((nextStatus: HomeFeedStatus) => {
    setSelectedStatuses((previous) => {
      userTouchedStatusesRef.current = true
      const next = new Set(previous)
      if (next.has(nextStatus)) {
        next.delete(nextStatus)
      } else {
        next.add(nextStatus)
      }
      return next
    })
  }, [])

  const setNextViewMode = useCallback((nextViewMode: HomeFeedViewMode) => {
    setViewMode(nextViewMode)
  }, [])

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

  useEffect(() => {
    if (status !== "ready" || !coords) return

    const now = Date.now()
    const last = lastLocationSyncRef.current
    const movedMeters = last
      ? kmDistance(
          { lat: last.latitude, lon: last.longitude },
          { lat: coords.latitude, lon: coords.longitude },
        ) * 1000
      : Number.POSITIVE_INFINITY

    const movedEnough = movedMeters >= 50
    const staleEnough = !last || now - last.at >= 60_000
    if (!movedEnough && !staleEnough) return

    let cancelled = false
    ;(async () => {
      try {
        const synced = await syncHelperLocation(coords.latitude, coords.longitude)
        if (!cancelled && synced) {
          lastLocationSyncRef.current = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            at: Date.now(),
          }
        }
      } catch {
        // best-effort heartbeat; UI should stay silent
      }
    })()

    return () => {
      cancelled = true
    }
  }, [coords?.latitude, coords?.longitude, status])

  useFocusEffect(
    useCallback(() => {
      if (status !== "ready" || !coords) return

      const statusesArg = userTouchedStatusesRef.current ? sortedStatuses : undefined
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
      void fetchNearby(coords.latitude, coords.longitude, statusesArg)
    }, [
      coords?.latitude,
      coords?.longitude,
      fetchNearby,
      radiusMeters,
      sortedStatuses,
      status,
      statusesKey,
    ]),
  )

  const availableStatuses = useMemo(() => {
    const list = Array.isArray(taskItems) ? taskItems : []
    const unique = Array.from(new Map(list.map((task) => [task.id, task])).values())

    const isMine = (task: HomeFeedTask) =>
      userId ? String(task.requesterId) === String(userId) : false

    let result = unique.filter((task) => (viewMode === "mine" ? isMine(task) : !isMine(task)))

    result = result.filter((task) => {
      if (task.status !== "PENDING_AUTH") return true
      if (viewMode === "mine") return true
      return userId ? String(task.pendingHelperId) === String(userId) : false
    })

    const activeStatuses = new Set<HomeFeedStatus>()
    result.forEach((task) => {
      const normalized = normalizeStatus(task.status)
      if (normalized) activeStatuses.add(normalized)
    })

    return STATUS_ORDER.filter((statusValue) => activeStatuses.has(statusValue))
  }, [taskItems, userId, viewMode])

  useEffect(() => {
    if (userTouchedStatusesRef.current) return
    if (loading) return
    if (!taskItems || taskItems.length === 0) return
    if (selectedStatuses.size > 0) return
    if (availableStatuses.length === 0) return

    suppressNextFetchRef.current = true
    setSelectedStatuses(new Set(availableStatuses))
  }, [availableStatuses, loading, selectedStatuses.size, taskItems])

  const onAcceptPress = useCallback(
    async (taskId: string) => {
      if (!coords) {
        refresh()
        Alert.alert(t("oolshik:homeScreen.locationNotAvailableTitle"))
        return
      }

      const result = await accept(taskId, coords.latitude, coords.longitude)
      if (result !== "OK") {
        Alert.alert(t("oolshik:homeScreen.failedToAccept"))
        return
      }

      await fetchNearby(coords.latitude, coords.longitude)
    },
    [accept, coords, fetchNearby, refresh, t],
  )

  const isTitleRefreshCooling = useCallback(
    (taskId: string) => {
      const cooldownUntil = titleRefreshCooldowns[taskId]
      return typeof cooldownUntil === "number" && cooldownUntil > Date.now()
    },
    [titleRefreshCooldowns],
  )

  const scheduleTitleRefreshCooldown = useCallback((taskId: string) => {
    const cooldownUntil = Date.now() + TITLE_REFRESH_COOLDOWN_MS
    setTitleRefreshCooldowns((previous) => ({ ...previous, [taskId]: cooldownUntil }))

    const existing = titleRefreshTimersRef.current.get(taskId)
    if (existing) clearTimeout(existing)

    const timer = setTimeout(() => {
      setTitleRefreshCooldowns((previous) => {
        if (!(taskId in previous)) return previous
        const next = { ...previous }
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
        Alert.alert(
          t("oolshik:homeScreen.locationNotAvailableTitle"),
          t("oolshik:homeScreen.locationNotAvailableBody"),
        )
        return
      }

      if (isTitleRefreshCooling(taskId)) return

      scheduleTitleRefreshCooldown(taskId)
      const statusesArg = sortedStatuses.length ? sortedStatuses : undefined

      try {
        await fetchNearby(coords.latitude, coords.longitude, statusesArg)
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
      t,
    ],
  )

  const renderItem = useCallback(
    ({ item }: { item: HomeFeedTask }) => {
      const titleText = typeof item.title === "string" ? item.title.trim() : ""
      const needsTitleRefresh = titleText === "..."
      const titleRefreshDisabled =
        needsTitleRefresh && (loading || isTitleRefreshCooling(item.id))

      const avgRating =
        userId && item.requesterId && item.requesterId === userId
          ? (item.helperAvgRating ?? null)
          : (item.requesterAvgRating ?? null)

      return (
        <TaskCard
          id={item.id}
          title={item.title}
          distanceMtr={getDistanceMeters(item)}
          status={item.status === "DRAFT" ? "OPEN" : item.status}
          voiceUrl={item.voiceUrl ? String(item.voiceUrl) : undefined}
          onAccept={
            viewMode === "forYou" && item.status === "OPEN"
              ? async () => {
                  await onAcceptPress(item.id)
                }
              : undefined
          }
          onTitleRefresh={
            needsTitleRefresh ? () => refreshTitleForTask(item.id) : undefined
          }
          titleRefreshDisabled={titleRefreshDisabled}
          onPress={() => navigation.navigate("OolshikDetail", { id: item.id })}
          createdByName={item.createdByName ?? item.requesterName}
          createdAt={item.createdAt}
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
    async ({ text, mode, voiceNote }: SubmitTaskInput) => {
      const title = text.trim()
      const isVoice = mode === "voice"

      if (!title) {
        throw new Error(t("oolshik:homeScreen.enterTitle"))
      }

      if (!coords) {
        refresh()
        throw new Error(t("oolshik:homeScreen.locationRequired"))
      }

      if (isVoice && !voiceNote) {
        throw new Error(t("oolshik:homeScreen.recordingMissing"))
      }

      if (creatingTask) {
        throw new Error(t("oolshik:homeScreen.alreadySubmitting"))
      }

      const effectiveRadiusKm =
        preferredRadiusKm != null ? normalizeRadius(preferredRadiusKm) : radiusMeters

      setCreatingTask(true)
      try {
        let voiceUrl: string | undefined

        if (voiceNote) {
          const uploaded = await uploadVoiceNote(voiceNote)
          if (!uploaded.ok) {
            throw new Error(t("oolshik:homeScreen.uploadFailed"))
          }
          voiceUrl = uploaded.url
        }

        const result = await createTask({
          title,
          description: undefined,
          voiceUrl,
          latitude: coords.latitude,
          longitude: coords.longitude,
          radiusMeters: effectiveRadiusKm * 1000,
          createdById: userId,
          createdByName: userName,
          createdAt: new Date().toISOString(),
        })

        if (!result.ok || !result.data) {
          throw new Error(result.message || t("oolshik:homeScreen.tryAgain"))
        }

        try {
          await fetchNearby(coords.latitude, coords.longitude)
        } catch {
          // best-effort refresh; no need to block success
        }
      } finally {
        setCreatingTask(false)
      }
    },
    [
      coords,
      creatingTask,
      fetchNearby,
      preferredRadiusKm,
      radiusMeters,
      refresh,
      t,
      userId,
      userName,
    ],
  )

  const onOpenSettings = useCallback(async () => {
    try {
      await Linking.openSettings()
    } catch {
      Alert.alert(
        t("oolshik:homeScreen.settingsOpenFailedTitle"),
        t("oolshik:homeScreen.settingsOpenFailedBody"),
      )
    }
  }, [t])

  const onPullToRefresh = useCallback(() => {
    if (status !== "ready" || !coords) {
      refresh()
      return
    }

    const statusesArg = sortedStatuses.length ? sortedStatuses : undefined
    void fetchNearby(coords.latitude, coords.longitude, statusesArg)
  }, [coords, fetchNearby, refresh, sortedStatuses, status])

  const onLogoutPress = useCallback(() => {
    Alert.alert(t("oolshik:homeScreen.logoutTitle"), t("oolshik:homeScreen.logoutBody"), [
      { text: t("common:cancel"), style: "cancel" },
      {
        text: t("common:logOut"),
        style: "destructive",
        onPress: () => {
          logout()
        },
      },
    ])
  }, [logout, t])

  const handleSearchOpen = useCallback(
    (open: boolean) => {
      setSearchOpen(open)
      if (!open) {
        setRawSearch("")
        setQuery("")
      }
    },
    [setQuery],
  )

  const handleSearchChange = useCallback(
    (nextValue: string) => {
      setRawSearch(nextValue)
      setQuery(nextValue)
    },
    [setQuery],
  )

  const handleSearchClear = useCallback(() => {
    setRawSearch("")
    setQuery("")
  }, [setQuery])

  const extraData = useMemo(
    () => ({
      radiusMeters,
      selected: Array.from(selectedStatuses).sort().join(","),
      viewMode,
      rawSearch,
    }),
    [radiusMeters, selectedStatuses, viewMode, rawSearch],
  )

  return {
    theme: {
      themeColors,
      spacing,
      isDark,
      profileTextColor,
    },
    location: {
      coords,
      status,
      locationError,
    },
    feed: {
      loading,
      filtered: filtered as HomeFeedTask[],
      viewMode,
      radiusMeters: radiusMeters as Radius,
      selectedStatuses,
      extraData,
    },
    user: {
      profileInitials,
    },
    refs: {
      searchInputRef,
    },
    state: {
      searchOpen,
      rawSearch,
      creatingTask,
    },
    handlers: {
      setViewMode: setNextViewMode,
      toggleStatus,
      setRadius: (radius: Radius) => setRadius(radius),
      onAcceptPress,
      renderItem,
      onSubmitTask: handleSubmitTask,
      onOpenSettings,
      onRefresh: onPullToRefresh,
      onLogoutPress,
      setSearchOpen: handleSearchOpen,
      onSearchChange: handleSearchChange,
      onSearchClear: handleSearchClear,
      openProfile: () => navigation.navigate("OolshikProfile"),
      openCreate: () => navigation.navigate("OolshikCreate"),
    },
  }
}
