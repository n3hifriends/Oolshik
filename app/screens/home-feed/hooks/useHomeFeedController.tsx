import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Alert, AppState, Linking, TextInput } from "react-native"
import { useOnForeground } from "@/hooks/useOnForeground"
import { useFocusEffect } from "@react-navigation/native"
import { useAppTheme } from "@/theme/context"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { useTaskStore } from "@/store/taskStore"
import { useAuth } from "@/context/AuthContext"
import { useRemoteConfig } from "@/services/remoteConfig"
import { useTaskFiltering } from "@/hooks/useTaskFiltering"
import { getDistanceMeters } from "@/utils/distance"
import { kmDistance } from "@/utils/haversine"
import { TaskCard } from "@/components/TaskCard"
import type { OolshikStackScreenProps } from "@/navigators/OolshikNavigator"
import { useActiveRequestCapGuard } from "@/features/active-cap/useActiveRequestCapGuard"
import type { AppApiError } from "@/api/apiResult"
import { logEvent, AnalyticsEvent } from "@/services/analytics"
import {
  getInitials,
  normalizeRadius,
  normalizeStatus,
  STATUS_ORDER,
  TITLE_REFRESH_COOLDOWN_MS,
} from "@/screens/home-feed/helpers/homeFeedFormatters"
import {
  createTask,
  loadHelperDefaults,
  syncHelperLocation,
  uploadVoiceNote,
} from "@/screens/home-feed/requesters/homeFeedRequester"
import type {
  HomeFeedSortKey,
  HomeFeedSortState,
  HomeFeedStatus,
  HomeFeedTask,
  HomeFeedViewMode,
  Radius,
  SubmitTaskInput,
  TranslateFn,
} from "@/screens/home-feed/types"

type Navigation = OolshikStackScreenProps<"OolshikHome">["navigation"]

type SortableFeedItem = {
  task: HomeFeedTask
  index: number
  distanceMeters: number | null
  createdAtMs: number | null
}

type FeedServiceState = {
  title: string
  body: string
  supportText?: string | null
  staleLabel?: string | null
  variant: "full" | "inline"
}

const DEFAULT_HOME_FEED_SORT: HomeFeedSortState = {
  key: "distance",
  direction: "asc",
}

const DEFAULT_MY_REQUESTS_SORT: HomeFeedSortState = {
  key: "time",
  direction: "asc",
}

const getSortableDistanceMeters = (task: HomeFeedTask): number | null => {
  const value = getDistanceMeters(task)
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

const getSortableCreatedAtMs = (task: HomeFeedTask): number | null => {
  const value = new Date(task.createdAt ?? "").getTime()
  return Number.isFinite(value) ? value : null
}

const compareNullableNumber = (
  left: number | null,
  right: number | null,
  direction: "asc" | "desc",
) => {
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  return direction === "asc" ? left - right : right - left
}

function buildFeedServiceState(
  error: AppApiError | null,
  hasVisibleTasks: boolean,
  lastNearbyLoadedAt: string | null,
  t: TranslateFn,
): FeedServiceState | null {
  if (!error) return null

  const loadedAt = formatLoadedAt(lastNearbyLoadedAt)
  const staleLabel = hasVisibleTasks
    ? loadedAt
      ? t("oolshik:homeScreen.serviceState.showingSavedResultsFrom", { time: loadedAt })
      : t("oolshik:homeScreen.serviceState.showingSavedResults")
    : null
  const supportText = error.requestId
    ? t("oolshik:homeScreen.serviceState.referenceId", { id: error.requestId })
    : null
  const variant = hasVisibleTasks ? "inline" : "full"

  switch (error.kind) {
    case "network":
    case "timeout":
      return {
        title: hasVisibleTasks
          ? t("oolshik:homeScreen.serviceState.networkInterruptedTitle")
          : t("oolshik:homeScreen.serviceState.networkUnreachableTitle"),
        body: hasVisibleTasks
          ? t("oolshik:homeScreen.serviceState.networkInterruptedBody")
          : t("oolshik:homeScreen.serviceState.networkUnreachableBody"),
        supportText,
        staleLabel,
        variant,
      }
    case "upstream":
    case "server":
      return {
        title: t("oolshik:homeScreen.serviceState.serverUnavailableTitle"),
        body: hasVisibleTasks
          ? t("oolshik:homeScreen.serviceState.serverUnavailableBodyStale")
          : t("oolshik:homeScreen.serviceState.serverUnavailableBody"),
        supportText,
        staleLabel,
        variant,
      }
    case "rate-limited":
      return {
        title: t("oolshik:homeScreen.serviceState.rateLimitedTitle"),
        body: hasVisibleTasks
          ? t("oolshik:homeScreen.serviceState.rateLimitedBodyStale")
          : t("oolshik:homeScreen.serviceState.rateLimitedBody"),
        supportText,
        staleLabel,
        variant,
      }
    case "unauthorized":
    case "forbidden":
      return {
        title: t("oolshik:homeScreen.serviceState.sessionTitle"),
        body: hasVisibleTasks
          ? t("oolshik:homeScreen.serviceState.sessionBodyStale")
          : t("oolshik:homeScreen.serviceState.sessionBody"),
        supportText,
        staleLabel,
        variant,
      }
    case "validation":
    case "conflict":
    case "rejected":
      return {
        title: t("oolshik:homeScreen.serviceState.validationTitle"),
        body: error.message || t("oolshik:homeScreen.serviceState.validationBody"),
        supportText,
        staleLabel,
        variant,
      }
    case "not-found":
      return {
        title: t("oolshik:homeScreen.serviceState.notFoundTitle"),
        body: t("oolshik:homeScreen.serviceState.notFoundBody"),
        supportText,
        staleLabel,
        variant,
      }
    case "bad-data":
    case "unknown":
    default:
      return {
        title: t("oolshik:homeScreen.serviceState.unknownTitle"),
        body: hasVisibleTasks
          ? t("oolshik:homeScreen.serviceState.unknownBodyStale")
          : t("oolshik:homeScreen.serviceState.unknownBody"),
        supportText,
        staleLabel,
        variant,
      }
  }
}

function formatLoadedAt(value: string | null) {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function useHomeFeedController({
  navigation,
  t,
}: {
  navigation: Navigation
  t: TranslateFn
}) {
  const { theme } = useAppTheme()
  const { colors: themeColors, spacing, isDark } = theme
  const activeCapGuard = useActiveRequestCapGuard(navigation)

  const {
    nearby_help_poll_interval_ms: rawPollIntervalMs,
    nearby_help_min_location_delta_meters: minLocationDeltaMeters,
  } = useRemoteConfig()
  // Clamp poll interval between 15s and 5min to prevent misconfigured RC values
  // from hammering the backend or making the feed feel completely dead.
  const pollIntervalMs = Math.min(Math.max(rawPollIntervalMs, 15_000), 300_000)

  const { coords, status, error: locationError, refresh } = useForegroundLocation()
  const {
    tasks,
    myTasks,
    fetchNearby,
    fetchMyTasks,
    loading,
    myTasksLoading,
    nearbyError,
    myTasksError,
    radiusMeters,
    setRadius,
    accept,
    isNearbyStale,
    lastNearbyLoadedAt,
    activeSummary,
    cachedActiveCount,
  } = useTaskStore()
  const { logout, userId, userName, authEmail, onboardingPhase, setOnboardingPhase } = useAuth()

  const lastFetchKeyRef = useRef<string | null>(null)
  const suppressNextFetchRef = useRef(false)
  const lastForegroundFetchRef = useRef<number>(0)
  const lastFocusFetchRef = useRef<number>(0)
  const [viewMode, setViewMode] = useState<HomeFeedViewMode>("forYou")
  const [creatingTask, setCreatingTask] = useState(false)
  const [preferredRadiusKm, setPreferredRadiusKm] = useState<number | null>(null)
  const [helperAvailable, setHelperAvailable] = useState(true)
  const [forYouSortState, setForYouSortState] = useState<HomeFeedSortState>(DEFAULT_HOME_FEED_SORT)
  const [myRequestsSortState, setMyRequestsSortState] =
    useState<HomeFeedSortState>(DEFAULT_MY_REQUESTS_SORT)
  const [forYouSelectedStatuses, setForYouSelectedStatuses] = useState<Set<HomeFeedStatus>>(
    new Set(),
  )
  const [myRequestSelectedStatuses, setMyRequestSelectedStatuses] = useState<Set<HomeFeedStatus>>(
    new Set(),
  )
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [controlsCondensed, setControlsCondensed] = useState(false)
  const controlsCondensedRef = useRef(false)
  const forYouTouchedStatusesRef = useRef(false)
  const myRequestsTouchedStatusesRef = useRef(false)

  const profileInitials = useMemo(
    () => getInitials(userName && userName !== "You" ? userName : undefined, authEmail ?? ""),
    [authEmail, userName],
  )

  const profileTextColor = isDark ? themeColors.palette.neutral100 : "#fff"

  const [titleRefreshCooldowns, setTitleRefreshCooldowns] = useState<Record<string, number>>({})
  const titleRefreshTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const lastLocationSyncRef = useRef<{ latitude: number; longitude: number; at: number } | null>(
    null,
  )

  const [searchOpen, setSearchOpen] = useState(false)
  const [rawSearch, setRawSearch] = useState("")
  const searchInputRef = useRef<TextInput>(null)

  const taskItems = (viewMode === "mine" ? myTasks : tasks) as HomeFeedTask[]
  const activeLoading = viewMode === "mine" ? myTasksLoading : loading
  const activeError = viewMode === "mine" ? myTasksError : nearbyError

  const selectedStatuses =
    viewMode === "forYou" ? forYouSelectedStatuses : myRequestSelectedStatuses
  const sortState = viewMode === "forYou" ? forYouSortState : myRequestsSortState
  const sortedStatuses = useMemo(() => Array.from(selectedStatuses).sort(), [selectedStatuses])
  const statusesKey = useMemo(() => sortedStatuses.join(","), [sortedStatuses])
  const hasVisibleTasks = taskItems.length > 0

  const { filtered } = useTaskFiltering(taskItems, {
    selectedStatuses,
    viewMode,
    myId: userId,
    rawQuery: rawSearch,
    t,
  })

  const sortedFiltered = useMemo(() => {
    const list = filtered as HomeFeedTask[]
    if (!Array.isArray(list) || list.length < 2) return list

    const decorated: SortableFeedItem[] = list.map((task, index) => ({
      task,
      index,
      distanceMeters: getSortableDistanceMeters(task),
      createdAtMs: getSortableCreatedAtMs(task),
    }))

    decorated.sort((left, right) => {
      const primaryCompare =
        sortState.key === "distance"
          ? compareNullableNumber(left.distanceMeters, right.distanceMeters, sortState.direction)
          : compareNullableNumber(
              left.createdAtMs,
              right.createdAtMs,
              sortState.direction === "asc" ? "desc" : "asc",
            )

      if (primaryCompare !== 0) return primaryCompare

      const recentFirstCompare = compareNullableNumber(left.createdAtMs, right.createdAtMs, "desc")
      if (recentFirstCompare !== 0) return recentFirstCompare

      const nearestFirstCompare = compareNullableNumber(
        left.distanceMeters,
        right.distanceMeters,
        "asc",
      )
      if (nearestFirstCompare !== 0) return nearestFirstCompare

      return left.index - right.index
    })

    return decorated.map((entry) => entry.task)
  }, [filtered, sortState.direction, sortState.key])

  useEffect(() => {
    return () => {
      titleRefreshTimersRef.current.forEach((timer) => clearTimeout(timer))
      titleRefreshTimersRef.current.clear()
    }
  }, [])

  const helperDefaultsLastLoadRef = useRef(0)
  useFocusEffect(
    useCallback(() => {
      // Skip if we loaded less than 500ms ago — rapid re-focus (e.g. Face ID,
      // notification banner) should not issue redundant AsyncStorage reads.
      const now = Date.now()
      if (now - helperDefaultsLastLoadRef.current < 500) return
      helperDefaultsLastLoadRef.current = now

      let active = true
      loadHelperDefaults()
        .then((defaults) => {
          if (!active) return
          setPreferredRadiusKm(defaults.preferredRadiusKm)
          setHelperAvailable(defaults.helperAvailable)
        })
        .catch(() => {})

      return () => {
        active = false
      }
    }, []),
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

  const toggleStatus = useCallback(
    (nextStatus: HomeFeedStatus) => {
      const setSelectedStatusesForView =
        viewMode === "forYou" ? setForYouSelectedStatuses : setMyRequestSelectedStatuses
      const touchedRef =
        viewMode === "forYou" ? forYouTouchedStatusesRef : myRequestsTouchedStatusesRef
      setSelectedStatusesForView((previous) => {
        touchedRef.current = true
        const next =
          previous.size === 0 && availableStatuses.length > 0
            ? new Set(availableStatuses)
            : new Set(previous)
        if (next.has(nextStatus)) {
          next.delete(nextStatus)
        } else {
          next.add(nextStatus)
        }
        return next
      })
    },
    [availableStatuses, viewMode],
  )

  const selectAllStatuses = useCallback(() => {
    if (viewMode === "forYou") {
      forYouTouchedStatusesRef.current = false
      setForYouSelectedStatuses(new Set())
      return
    }
    myRequestsTouchedStatusesRef.current = false
    setMyRequestSelectedStatuses(new Set())
  }, [viewMode])

  const toggleSort = useCallback(
    (key: HomeFeedSortKey) => {
      if (viewMode === "mine" && key === "distance") return
      const setSortStateForView =
        viewMode === "forYou" ? setForYouSortState : setMyRequestsSortState
      setSortStateForView((previous) => {
        if (previous.key === key) {
          return {
            key,
            direction: previous.direction === "asc" ? "desc" : "asc",
          }
        }

        return {
          key,
          direction: "asc",
        }
      })
    },
    [viewMode],
  )

  const setNextViewMode = useCallback((nextViewMode: HomeFeedViewMode) => {
    setViewMode(nextViewMode)
    setFiltersExpanded(false)
  }, [])

  useEffect(() => {
    if (!helperAvailable || status !== "ready" || !coords) return

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
  }, [coords?.latitude, coords?.longitude, helperAvailable, status])

  useFocusEffect(
    useCallback(() => {
      if (viewMode === "mine") {
        const cooldownMs = myTasksError ? (myTasksError.retryAfterMs ?? 30_000) : 10_000
        if (Date.now() - lastFocusFetchRef.current < cooldownMs) return
        lastFocusFetchRef.current = Date.now()
        void fetchMyTasks()
        return
      }

      if (status !== "ready" || !coords) return
      if (viewMode === "forYou" && !helperAvailable) return

      // Don't hammer a 503 on every re-navigation. Mirror useOnForeground's
      // backoff: respect retryAfterMs from the error, fall back to 30s.
      if (nearbyError) {
        const cooldownMs = nearbyError.retryAfterMs ?? 30_000
        if (Date.now() - lastFocusFetchRef.current < cooldownMs) return
      }

      const shouldUseStatusFilter = viewMode === "forYou" && forYouTouchedStatusesRef.current
      const statusesArg = shouldUseStatusFilter ? sortedStatuses : undefined
      // Snap coordinates to the nearest bin of size `minLocationDeltaMeters`.
      // 1° latitude ≈ 111km; rounding to bin boundaries prevents sub-threshold
      // GPS jitter from generating a new fetch key on every GPS update.
      const binDeg = Math.max(minLocationDeltaMeters, 10) / 111_000
      const latBin = Math.round(coords.latitude / binDeg) * binDeg
      const lonBin = Math.round(coords.longitude / binDeg) * binDeg
      const key = [
        latBin.toFixed(6),
        lonBin.toFixed(6),
        radiusMeters,
        shouldUseStatusFilter ? statusesKey : "auto",
      ].join("|")

      if (suppressNextFetchRef.current) {
        suppressNextFetchRef.current = false
        lastFetchKeyRef.current = key
        return
      }

      if (lastFetchKeyRef.current === key) return

      lastFetchKeyRef.current = key
      lastFocusFetchRef.current = Date.now()
      void fetchNearby(coords.latitude, coords.longitude, statusesArg)
    }, [
      coords?.latitude,
      coords?.longitude,
      fetchMyTasks,
      fetchNearby,
      helperAvailable,
      minLocationDeltaMeters,
      myTasksError,
      nearbyError,
      radiusMeters,
      sortedStatuses,
      status,
      statusesKey,
      viewMode,
    ]),
  )

  // Ref that always holds the latest values needed by the polling callback.
  // Using a ref keeps the setInterval stable — the interval is only restarted
  // when pollIntervalMs changes from Remote Config, not on every GPS tick.
  const pollParamsRef = useRef({
    coords,
    helperAvailable,
    status,
    sortedStatuses,
    viewMode,
    fetchNearby,
    fetchMyTasks,
    forYouTouchedStatusesRef,
    nearbyError,
    myTasksError,
  })
  pollParamsRef.current = {
    coords,
    helperAvailable,
    status,
    sortedStatuses,
    viewMode,
    fetchNearby,
    fetchMyTasks,
    forYouTouchedStatusesRef,
    nearbyError,
    myTasksError,
  }

  useFocusEffect(
    useCallback(() => {
      const timerId = setInterval(() => {
        if (AppState.currentState !== "active") return
        const p = pollParamsRef.current
        if (p.viewMode === "mine") return // "mine" tab is refresh-on-focus only, no polling
        if (p.status !== "ready" || !p.coords) return
        if (p.viewMode === "forYou" && !p.helperAvailable) return
        // Stop polling while the backend is returning errors — avoids hammering
        // a 503 on every tick. The user can retry manually, or the next
        // foreground event will attempt a fresh fetch.
        if (p.nearbyError) return
        const statusesArg =
          p.viewMode === "forYou" && p.forYouTouchedStatusesRef.current
            ? p.sortedStatuses
            : undefined
        void p.fetchNearby(p.coords.latitude, p.coords.longitude, statusesArg)
      }, pollIntervalMs)
      return () => clearInterval(timerId)
    }, [pollIntervalMs]),
  )

  useOnForeground(() => {
    const p = pollParamsRef.current

    if (p.viewMode === "mine") {
      const cooldownMs = p.myTasksError ? (p.myTasksError.retryAfterMs ?? 30_000) : 10_000
      if (Date.now() - lastFocusFetchRef.current < cooldownMs) return
      lastFocusFetchRef.current = Date.now()
      void p.fetchMyTasks()
      return
    }

    if (p.status !== "ready" || !p.coords) return
    if (p.viewMode === "forYou" && !p.helperAvailable) return

    // Always apply a minimum cooldown between foreground fetches. System events
    // (notification banners, Face ID checks) also flip inactive→active and would
    // otherwise fire fetchNearby unconditionally when the server is healthy.
    // On error, honour the server's retryAfterMs hint or fall back to 30s.
    const cooldownMs = p.nearbyError ? (p.nearbyError.retryAfterMs ?? 30_000) : 10_000
    if (Date.now() - lastForegroundFetchRef.current < cooldownMs) return

    const statusesArg =
      p.viewMode === "forYou" && p.forYouTouchedStatusesRef.current ? p.sortedStatuses : undefined
    lastForegroundFetchRef.current = Date.now()
    void p.fetchNearby(p.coords.latitude, p.coords.longitude, statusesArg)
  })

  useEffect(() => {
    const touchedRef =
      viewMode === "forYou" ? forYouTouchedStatusesRef : myRequestsTouchedStatusesRef
    const setSelectedStatusesForView =
      viewMode === "forYou" ? setForYouSelectedStatuses : setMyRequestSelectedStatuses
    const matchesAvailableStatuses =
      selectedStatuses.size === availableStatuses.length &&
      availableStatuses.every((statusValue) => selectedStatuses.has(statusValue))
    if (touchedRef.current) return
    if (activeLoading) return
    if (!taskItems || taskItems.length === 0) return
    if (matchesAvailableStatuses) return
    if (availableStatuses.length === 0) return

    if (viewMode === "forYou") {
      suppressNextFetchRef.current = true
    }
    setSelectedStatusesForView(new Set(availableStatuses))
  }, [availableStatuses, activeLoading, selectedStatuses, taskItems, viewMode])

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
      const statusesArg =
        viewMode === "forYou" && sortedStatuses.length ? sortedStatuses : undefined

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
      viewMode,
    ],
  )

  const renderItem = useCallback(
    ({ item }: { item: HomeFeedTask }) => {
      const titleText = typeof item.title === "string" ? item.title.trim() : ""
      const normalizedVoiceUrl = typeof item.voiceUrl === "string" ? item.voiceUrl.trim() : ""
      const needsTitleRefresh = titleText === "..."
      const titleRefreshDisabled = needsTitleRefresh && (loading || isTitleRefreshCooling(item.id))

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
          voiceUrl={normalizedVoiceUrl || undefined}
          onAccept={
            viewMode === "forYou" && item.status === "OPEN"
              ? async () => {
                  await onAcceptPress(item.id)
                }
              : undefined
          }
          onTitleRefresh={needsTitleRefresh ? () => refreshTitleForTask(item.id) : undefined}
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

      const canCreate = await activeCapGuard.ensureCanCreateRequestOrRedirect()
      if (!canCreate) {
        throw activeCapGuard.createHandledError()
      }

      const effectiveRadiusKm =
        preferredRadiusKm != null ? normalizeRadius(preferredRadiusKm) : radiusMeters

      setCreatingTask(true)
      try {
        let audioFileId: string | undefined

        if (voiceNote) {
          const uploaded = await uploadVoiceNote(voiceNote)
          if (!uploaded.ok) {
            throw new Error(t("oolshik:homeScreen.uploadFailed"))
          }
          audioFileId = uploaded.audioFileId
        }

        const result = await createTask({
          title,
          description: undefined,
          audioFileId,
          latitude: coords.latitude,
          longitude: coords.longitude,
          radiusMeters: effectiveRadiusKm * 1000,
          createdById: userId,
          createdByName: userName,
          createdAt: new Date().toISOString(),
        })

        if (!result.ok || !result.data) {
          if (result.activeCap) {
            activeCapGuard.handleCreateCapResponse(result.activeCap)
            throw activeCapGuard.createHandledError()
          }
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
      activeCapGuard,
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
    if (viewMode === "mine") {
      void fetchMyTasks()
      return
    }
    if (status !== "ready" || !coords) {
      refresh()
      return
    }
    if (viewMode === "forYou" && !helperAvailable) return

    const statusesArg = viewMode === "forYou" && sortedStatuses.length ? sortedStatuses : undefined
    void fetchNearby(coords.latitude, coords.longitude, statusesArg)
  }, [coords, fetchMyTasks, fetchNearby, helperAvailable, refresh, sortedStatuses, status, viewMode])

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

  const handleSearchOpen = useCallback((open: boolean) => {
    setSearchOpen(open)
    if (!open) {
      setRawSearch("")
    }
  }, [])

  const handleSearchChange = useCallback((nextValue: string) => {
    setRawSearch(nextValue)
  }, [])

  const handleSearchClear = useCallback(() => {
    setRawSearch("")
  }, [])

  const extraData = useMemo(
    () => ({
      viewMode,
      loading: activeLoading,
      titleRefreshCooldowns,
    }),
    [activeLoading, titleRefreshCooldowns, viewMode],
  )

  const serviceState = useMemo(
    () => buildFeedServiceState(activeError, hasVisibleTasks, viewMode === "mine" ? null : lastNearbyLoadedAt, t),
    [activeError, hasVisibleTasks, lastNearbyLoadedAt, t, viewMode],
  )

  const helperFeedEnabled = viewMode !== "forYou" || helperAvailable
  const visibleFiltered = helperFeedEnabled ? sortedFiltered : []
  const showInitialLoader = helperFeedEnabled && activeLoading && visibleFiltered.length === 0

  const setFeedRadius = useCallback(
    (radius: Radius) => {
      setRadius(radius)
    },
    [setRadius],
  )

  const handleToggleFiltersExpanded = useCallback(() => {
    setFiltersExpanded((previous) => !previous)
  }, [])

  const handleListScrollOffsetChange = useCallback((offsetY: number) => {
    const isCurrentlyCondensed = controlsCondensedRef.current
    // Hysteresis: condense when scrolled down >32px, expand only when back under 8px.
    // A single threshold causes rapid toggling near the boundary, producing flicker.
    const nextCondensed = isCurrentlyCondensed ? offsetY > 8 : offsetY > 32
    if (controlsCondensedRef.current === nextCondensed) return
    controlsCondensedRef.current = nextCondensed
    setControlsCondensed(nextCondensed)
    if (nextCondensed) {
      setFiltersExpanded(false)
    }
  }, [])

  const isFirstRun = !onboardingPhase || onboardingPhase === "FRESH"

  const handleIntentSelected = useCallback(
    (intent: "getHelp" | "helpOthers" | "skip") => {
      logEvent(AnalyticsEvent.ONBOARDING_INTENT_SELECTED, { intent })
      setOnboardingPhase("INTENT_SET")
      if (intent === "getHelp") {
        setNextViewMode("mine")
      } else if (intent === "helpOthers") {
        setNextViewMode("forYou")
        if (status !== "ready") refresh()
      }
    },
    [setOnboardingPhase, setNextViewMode, status, refresh],
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
      loading: activeLoading,
      showInitialLoader,
      hasVisibleTasks,
      nearbyError: activeError,
      isNearbyStale: viewMode === "mine" ? false : isNearbyStale,
      lastNearbyLoadedAt: viewMode === "mine" ? null : lastNearbyLoadedAt,
      serviceState,
      filtered: visibleFiltered as HomeFeedTask[],
      helperAvailable,
      viewMode,
      radiusMeters: radiusMeters as Radius,
      selectedStatuses,
      availableStatuses,
      sort: sortState,
      filtersExpanded,
      controlsCondensed,
      extraData,
      activeCount: activeSummary?.activeCount ?? cachedActiveCount ?? 0,
    },
    user: {
      profileInitials,
      isFirstRun,
      userName,
    },
    refs: {
      searchInputRef,
    },
    state: {
      searchOpen,
      rawSearch,
      creatingTask,
      activeCapDialog: activeCapGuard.dialogProps,
    },
    handlers: {
      setViewMode: setNextViewMode,
      toggleStatus,
      selectAllStatuses,
      setRadius: setFeedRadius,
      toggleSort,
      toggleFiltersExpanded: handleToggleFiltersExpanded,
      onListScrollOffsetChange: handleListScrollOffsetChange,
      onAcceptPress,
      renderItem,
      onSubmitTask: handleSubmitTask,
      onOpenSettings,
      onRefresh: onPullToRefresh,
      onLogoutPress,
      setSearchOpen: handleSearchOpen,
      onSearchChange: handleSearchChange,
      onSearchClear: handleSearchClear,
      onIntentSelected: handleIntentSelected,
      onBeforeComposerOpen: activeCapGuard.ensureCanCreateRequestOrRedirect,
      openProfile: () => navigation.navigate("OolshikProfile"),
      openCreate: async () => {
        const canCreate = await activeCapGuard.ensureCanCreateRequestOrRedirect()
        if (!canCreate) return
        navigation.navigate("OolshikCreate")
      },
    },
  }
}
