import { create } from "zustand"
// import your real API if you have it here
// import { OolshikApi } from "@/api"
import { FLAGS } from "@/config/flags"
import { MOCK_NEARBY_TASKS } from "@/mocks/nearbyTasks"
import { OolshikApi } from "@/api"

type Task = {
  id: string
  voiceUrl?: string | null
  description?: string
  distanceKm?: number
  status: "PENDING" | "ASSIGNED" | "COMPLETED"
  createdById?: string
  createdByName?: string
  createdAt?: string // ISO
}

type TaskTab = "ALL" | "CREATED" | "ACCEPTED" | "COMPLETED"

type State = {
  radiusKm: 1 | 2 | 5
  tasks: Task[]
  myTasks: Task[]
  loading: boolean
  tab: TaskTab
  setRadius: (r: 1 | 2 | 5) => void
  setTab: (t: TaskTab) => void
  fetchNearby: (lat: number, lng: number) => Promise<void>
  accept: (id: string) => Promise<"OK" | "ALREADY">
}

export const useTaskStore = create<State>((set, get) => ({
  radiusKm: 1,
  tasks: [],
  myTasks: [],
  loading: false,
  tab: "ALL",
  setRadius: (r) => set({ radiusKm: r }),
  setTab: (t) => set({ tab: t }),

  fetchNearby: async (_lat, _lng) => {
    set({ loading: true })
    try {
      if (FLAGS.USE_MOCK_NEARBY) {
        // simulate network delay
        await new Promise((r) => setTimeout(r, 600))

        // filter/sort by selected radius
        const r = get().radiusKm
        const filtered = MOCK_NEARBY_TASKS.filter((t) => (t.distanceKm ?? 0) <= r).sort(
          (a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0),
        )

        set({ tasks: filtered })
      } else {
        // --- real API path (uncomment when backend is ready) ---
        // const r = get().radiusKm
        // const res = await OolshikApi.nearbyTasks(_lat, _lng, r)
        // if (res.ok && res.data) set({ tasks: res.data })
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
      // --- real API path (uncomment later) ---
      const res = await OolshikApi.acceptTask(id)
      if (res.ok) {
        set((s) => ({
          tasks: s.tasks.map((t) => (t.id === id ? { ...t, status: "ASSIGNED" } : t)),
        }))
        return "OK"
      }
      if (res.status === 409) return "ALREADY"
      return "ALREADY"

      return "OK"
    }
  },
}))
