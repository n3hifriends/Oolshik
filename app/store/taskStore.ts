import { create } from "zustand"
import { FLAGS } from "@/config/flags"
import { MOCK_NEARBY_TASKS } from "@/mocks/nearbyTasks"
import { OolshikApi } from "@/api"

type Task = {
  id: string
  voiceUrl?: string | null
  title?: string
  description?: string
  distanceKm?: number
  status: "PENDING" | "ASSIGNED" | "COMPLETED" | "OPEN" | "CANCELLED" | "CANCELED"
  createdById?: string
  createdByName?: string
  createdAt?: string // ISO
  createdByPhoneNumber?: string
}

type TaskTab = "ALL" | "CREATED" | "ACCEPTED" | "COMPLETED"

type State = {
  radiusMeters: 1 | 2 | 5
  tasks: Task[]
  myTasks: Task[]
  loading: boolean
  tab: TaskTab
  setRadius: (r: 1 | 2 | 5) => void
  setTab: (t: TaskTab) => void
  fetchNearby: (lat: number, lng: number, statuses?: string[]) => Promise<void>
  accept: (id: string) => Promise<"OK" | "ALREADY" | "ERROR">
  complete: (id: string) => Promise<"OK" | "FORBIDDEN" | "ERROR">
}

export const useTaskStore = create<State>((set, get) => ({
  radiusMeters: 1,
  tasks: [],
  myTasks: [],
  loading: false,
  tab: "ALL",
  setRadius: (r) => set({ radiusMeters: r }),
  setTab: (t) => set({ tab: t }),

  fetchNearby: async (lat, lon, statuses?: string[]) => {
    set({ loading: true })
    try {
      if (FLAGS.USE_MOCK_NEARBY) {
        await new Promise((r) => setTimeout(r, 300))
        const r = get().radiusMeters
        const allowed = new Set(
          (statuses?.length ? statuses : ["OPEN", "ASSIGNED", "COMPLETED", "CANCELLED"]) as any,
        )
        const filtered = MOCK_NEARBY_TASKS.filter(
          (t) => (t.distanceKm ?? 0) <= r && allowed.has(t.status),
        ).sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
        set({ tasks: filtered })
      } else {
        const r = get().radiusMeters
        const res = await OolshikApi.nearbyTasks(lat, lon, 1000 * r, statuses)
        if (res.ok) set({ tasks: res.data ?? [] })
      }
    } finally {
      set({ loading: false })
    }
  },

  accept: async (id) => {
    if (FLAGS.USE_MOCK_NEARBY) {
      // optimistic accept in mock mode
      set((s) => ({
        tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: "ASSIGNED" } : t)),
      }))
      return "OK"
    } else {
      const res = await OolshikApi.acceptTask(id)
      if (res.ok) {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: "ASSIGNED" } : t)),
        }))
        return "OK"
      }
      if (res.status === 409) return "ALREADY"
      return "ERROR"
    }
  },

  complete: async (id) => {
    if (FLAGS.USE_MOCK_NEARBY) {
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
