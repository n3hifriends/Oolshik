// app/api/mockClient.ts
import type { Task } from "./client"

const dummyTasks: Task[] = [
  {
    id: "T-MOCK-1",
    description: "Fetch groceries",
    voiceUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    status: "PENDING",
    lat: 18.5204, // Pune
    lng: 73.8567,
    radiusKm: 1,
    createdById: "U-01",
    createdByName: "Amit",
    createdAt: new Date().toISOString(),
    distanceKm: 0.3,
  },
  // add more seeds if you want
]

// small wait to mimic network
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms))
const toRad = (d: number) => (d * Math.PI) / 180
function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)
  const sLat1 = toRad(aLat)
  const sLat2 = toRad(bLat)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(sLat1) * Math.cos(sLat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export const MockOolshikApi = {
  // Accept optional params to match real signature
  async nearbyTasks(lat?: number, lng?: number, radiusKm?: number) {
    await wait(150)

    // If no coords provided, just return all with existing distances
    if (lat == null || lng == null || radiusKm == null) {
      return { ok: true as const, data: dummyTasks.slice() }
    }

    const withDistances = dummyTasks.map((t) => ({
      ...t,
      distanceKm: kmBetween(lat, lng, t.lat, t.lng),
    }))
    const filtered = withDistances
      .filter((t) => (t.distanceKm ?? Infinity) <= radiusKm)
      .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))

    return { ok: true as const, data: filtered }
  },

  async getPresigned(_contentType: string) {
    await wait(100)
    return {
      ok: true as const,
      data: { uploadUrl: "mock://skip-upload", fileUrl: "https://mock.local/files/new-audio.m4a" },
    }
  },

  async createTask(payload: Partial<Task>) {
    await wait(120)
    const newTask: Task = {
      id: `T-MOCK-${dummyTasks.length + 1}`,
      status: "PENDING",
      distanceKm: 0,
      createdAt: payload.createdAt ?? new Date().toISOString(),
      createdById: payload.createdById ?? "U-LOCAL-1",
      createdByName: payload.createdByName ?? "You",
      voiceUrl: payload.voiceUrl ?? "",
      description: payload.description ?? "",
      lat: payload.lat ?? 0,
      lng: payload.lng ?? 0,
      radiusKm: payload.radiusKm ?? 1,
    }
    dummyTasks.unshift(newTask) // append to the dummy feed
    return { ok: true as const, data: newTask }
  },

  async acceptTask(id: string) {
    const t = dummyTasks.find((x) => String(x.id) === String(id))
    if (t) t.status = "ASSIGNED"
    return { ok: true as const }
  },

  async completeTask(id: string) {
    const t = dummyTasks.find((x) => String(x.id) === String(id))
    if (t) t.status = "COMPLETED"
    return { ok: true as const }
  },

  addReview: async () => ({ ok: true as const }),
  report: async () => ({ ok: true as const }),
  registerDevice: async () => ({ ok: true as const }),
}
