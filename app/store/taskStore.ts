import { create } from "zustand"
import { getRemoteFlag } from "@/services/remoteConfig"
import { MOCK_NEARBY_TASKS } from "@/mocks/nearbyTasks"
import { OolshikApi } from "@/api"
import type { AppApiError } from "@/api/apiResult"
import { load, remove, save } from "@/utils/storage"

const nearbyKey = (uid: string) => `nearby.cache.v2.${uid}`
type NearbyCacheEntry = { tasks: Task[]; lastNearbyLoadedAt: string }

// Monotonic counter — incremented on every fetchNearby call.
// Each call captures its own value and ignores responses from older calls.
let nearbyFetchSeq = 0

// Tracks which user's cache is currently loaded. Set by hydrateForUser, cleared by clearNearby.
let currentUserId: string | null = null

type Task = {
  id: string
  voiceUrl?: string | null
  title?: string
  description?: string
  distanceMtr?: number
  status:
    | "DRAFT"
    | "PENDING"
    | "PENDING_AUTH"
    | "ASSIGNED"
    | "WORK_DONE_PENDING_CONFIRMATION"
    | "REVIEW_REQUIRED"
    | "COMPLETED"
    | "OPEN"
    | "CANCELLED"
    | "CANCELED"
  latitude?: number
  longitude?: number
  requesterId?: string
  helperId?: string | null
  pendingHelperId?: string | null
  createdById?: string
  createdByName?: string
  createdAt?: string // ISO
  updatedAt?: string // ISO
  createdByPhoneNumber?: string
  helperName?: string | null
  requesterPhoneNumber?: string
  helperPhoneNumber?: string
  ratingValue?: number | null
  ratingByRequester?: number | null
  ratingByHelper?: number | null
  requesterAvgRating?: number | null
  helperAvgRating?: number | null
  offerAmount?: number | null
  offerCurrency?: string | null
  offerUpdatedAt?: string | null
  helperAcceptedAt?: string | null
  assignmentExpiresAt?: string | null
  pendingAuthExpiresAt?: string | null
  cancelledAt?: string | null
  cancelledBy?: string | null
  workDoneAt?: string | null
  completionConfirmationExpiresAt?: string | null
  completionMode?: string | null
  reassignedCount?: number | null
  releasedCount?: number | null
}

type TaskTab = "ALL" | "CREATED" | "ACCEPTED" | "COMPLETED"

const normalizeStatus = (
  status?: Task["status"] | string | null,
):
  | "OPEN"
  | "PENDING_AUTH"
  | "ASSIGNED"
  | "WORK_DONE_PENDING_CONFIRMATION"
  | "REVIEW_REQUIRED"
  | "COMPLETED"
  | "CANCELLED" => {
  const raw = String(status ?? "")
    .trim()
    .toUpperCase()
  if (!raw) return "OPEN"
  if (raw === "PENDING" || raw === "DRAFT") return "OPEN"
  if (raw === "CANCELED") return "CANCELLED"
  if (
    raw === "OPEN" ||
    raw === "PENDING_AUTH" ||
    raw === "ASSIGNED" ||
    raw === "WORK_DONE_PENDING_CONFIRMATION" ||
    raw === "REVIEW_REQUIRED" ||
    raw === "COMPLETED" ||
    raw === "CANCELLED"
  ) {
    return raw as any
  }
  return "OPEN"
}

const normalizeTasks = (items?: Task[] | null) =>
  (items ?? []).map((t) => ({ ...t, status: normalizeStatus(t.status) }))

type State = {
  radiusMeters: 1 | 2 | 5
  tasks: Task[]
  myTasks: Task[]
  loading: boolean
  nearbyError: AppApiError | null
  isNearbyStale: boolean
  lastNearbyLoadedAt: string | null
  tab: TaskTab
  setRadius: (r: 1 | 2 | 5) => void
  setTab: (t: TaskTab) => void
  upsertTask: (task: Task) => void
  fetchNearby: (lat: number, lng: number, statuses?: string[]) => Promise<void>
  hydrateForUser: (userId: string) => void
  clearNearby: () => void
  accept: (id: string, latitude: number, longitude: number) => Promise<"OK" | "ALREADY" | "ERROR">
  complete: (id: string) => Promise<"OK" | "FORBIDDEN" | "ERROR">
}

export const useTaskStore = create<State>((set, get) => ({
  radiusMeters: 1,
  tasks: [],
  myTasks: [],
  loading: false,
  nearbyError: null,
  isNearbyStale: false,
  lastNearbyLoadedAt: null,
  tab: "ALL",
  setRadius: (r) => set({ radiusMeters: r }),
  setTab: (t) => set({ tab: t }),
  upsertTask: (task) =>
    set((s) => {
      const idx = s.tasks.findIndex((t) => t.id === task.id)
      if (idx === -1) return { tasks: [task, ...s.tasks] }
      const next = s.tasks.slice()
      next[idx] = { ...next[idx], ...task }
      return { tasks: next }
    }),

  fetchNearby: async (lat, lon, statuses?: string[]) => {
    const seq = ++nearbyFetchSeq
    const requestUserId = currentUserId
    set({ loading: true })
    try {
      if (getRemoteFlag("mock_nearby_enabled") && __DEV__) {
        await new Promise((r) => setTimeout(r, 300))
        if (seq !== nearbyFetchSeq) return
        const r = get().radiusMeters
        const allowed = new Set(
          (statuses?.length
            ? statuses
            : [
                "OPEN",
                "PENDING_AUTH",
                "ASSIGNED",
                "WORK_DONE_PENDING_CONFIRMATION",
                "REVIEW_REQUIRED",
                "COMPLETED",
                "CANCELLED",
              ]) as any,
        )
        const filtered = normalizeTasks(MOCK_NEARBY_TASKS)
          .filter((t) => (t.distanceMtr ?? 0) <= r && allowed.has(t.status))
          .sort((a, b) => (a.distanceMtr ?? 0) - (b.distanceMtr ?? 0))
        const loadedAt = new Date().toISOString()
        set({ tasks: filtered, nearbyError: null, isNearbyStale: false, lastNearbyLoadedAt: loadedAt })
      } else {
        const r = get().radiusMeters
        const res = await OolshikApi.nearbyTasks(lat, lon, 1000 * r, statuses)
        if (seq !== nearbyFetchSeq || currentUserId !== requestUserId) return
        if (res.ok) {
          const normalized = normalizeTasks(res.data as Task[])
          const loadedAt = new Date().toISOString()
          set({ tasks: normalized, nearbyError: null, isNearbyStale: false, lastNearbyLoadedAt: loadedAt })
          if (requestUserId) {
            save(nearbyKey(requestUserId), { tasks: normalized, lastNearbyLoadedAt: loadedAt } satisfies NearbyCacheEntry)
          }
          return
        }
        const hasVisibleTasks = get().tasks.length > 0
        set({ nearbyError: res.error, isNearbyStale: hasVisibleTasks })
      }
    } finally {
      if (seq === nearbyFetchSeq) set({ loading: false })
    }
  },

  hydrateForUser: (userId) => {
    if (currentUserId === userId) return
    nearbyFetchSeq++
    currentUserId = userId
    const cached = load<NearbyCacheEntry>(nearbyKey(userId))
    if (!cached?.tasks?.length) {
      set({ tasks: [], lastNearbyLoadedAt: null, isNearbyStale: false })
      return
    }
    set({
      tasks: normalizeTasks(cached.tasks),
      lastNearbyLoadedAt: cached.lastNearbyLoadedAt,
      isNearbyStale: true,
    })
  },

  clearNearby: () => {
    nearbyFetchSeq++
    if (currentUserId) remove(nearbyKey(currentUserId))
    currentUserId = null
    set({ tasks: [], lastNearbyLoadedAt: null, isNearbyStale: false, nearbyError: null })
  },

  accept: async (id: string, latitude: number, longitude: number) => {
    if (getRemoteFlag("mock_nearby_enabled") && __DEV__) {
      // optimistic accept in mock mode
      set((s) => ({
        tasks: s.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                status: "PENDING_AUTH",
                pendingAuthExpiresAt: new Date(Date.now() + 120 * 1000).toISOString(),
              }
            : t,
        ),
      }))
      return "OK"
    } else {
      const res = await OolshikApi.acceptTask(id, { latitude, longitude })
      if (res.ok) {
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, ...(res.data as any), status: "PENDING_AUTH" } : t,
          ),
        }))
        return "OK"
      }
      if (res.status === 409) return "ALREADY"
      return "ERROR"
    }
  },

  complete: async (id) => {
    if (getRemoteFlag("mock_nearby_enabled") && __DEV__) {
      // In mock mode, allow completion if requester unknown; otherwise block (no auth context here)
      let updated = false
      set((s) => {
        const next = s.tasks.map((t) => {
          if (t.id !== id) return t
          const meId = undefined // no auth lookup in this store
          const allowed = !t.createdById || (meId && t.createdById === meId)
          if (allowed) {
            updated = true
            return { ...t, status: "COMPLETED" as const }
          }
          return t
        })
        return { tasks: next }
      })
      return updated ? "OK" : "FORBIDDEN"
    } else {
      const res = await OolshikApi.completeTask(id)
      if (res.ok) {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: "COMPLETED" } : t)),
        }))
        return "OK"
      }
      // Backend throws when non-requester completes
      if (
        res.status === 403 ||
        res.status === 409 ||
        String(res.data || "").includes("Only requester can complete")
      ) {
        return "FORBIDDEN"
      }
      return "ERROR"
    }
  },
}))
