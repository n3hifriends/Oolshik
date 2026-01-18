// app/api/mockClient.ts
import type { Task } from "./client"

// --- Mock OTP state (in-memory) ---
let _lastOtpPhone: string | undefined
let _lastOtpCode: string | undefined
let _lastOtpExpiresAt: number | undefined // epoch ms

function _setMockOtp(phone: string) {
  _lastOtpPhone = phone
  _lastOtpCode = "123456" // fixed code for mock
  _lastOtpExpiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes
}

function _isOtpValid(phone: string, code: string) {
  if (!_lastOtpPhone || !_lastOtpCode || !_lastOtpExpiresAt) return false
  if (Date.now() > _lastOtpExpiresAt) return false
  return _lastOtpPhone === phone && _lastOtpCode === code
}

const dummyTasks: Task[] = [
  {
    id: "T-MOCK-1",
    description: "Fetch groceries",
    title: "Fetch groceries",
    voiceUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    status: "PENDING",
    latitude: 18.5204, // Pune
    longitude: 73.8567,
    radiusMeters: 1,
    createdAt: new Date().toISOString(),
  },
  // add more seeds if you want
]

// small wait to mimic network
const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms))
const toRad = (d: number) => (d * Math.PI) / 180
function kmBetween(aLat: number, alon: number, bLat: number, blon: number) {
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dlon = toRad(blon - alon)
  const sLat1 = toRad(aLat)
  const sLat2 = toRad(bLat)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(sLat1) * Math.cos(sLat2) * Math.sin(dlon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export const MockOolshikApi = {
  // Accept optional params to match real signature
  async nearbyTasks(lat?: number, lon?: number, radiusMeters?: number) {
    await wait(150)

    // If no coords provided, just return all with existing distances
    if (lat == null || lon == null || radiusMeters == null) {
      return { ok: true as const, data: dummyTasks.slice() }
    }

    const withDistances = dummyTasks.map((t) => ({
      ...t,
      distanceMtr: kmBetween(lat, lon, t.latitude, t.longitude),
    }))
    const filtered = withDistances
      .filter((t) => (t.distanceMtr ?? Infinity) <= radiusMeters)
      .sort((a, b) => (a.distanceMtr ?? 0) - (b.distanceMtr ?? 0))

    return { ok: true as const, data: filtered }
  },

  async getPresigned(_contentType: string) {
    await wait(100)
    return {
      ok: true as const,
      data: { uploadUrl: "mock://skip-upload", fileUrl: "https://mock.local/files/new-audio.m4a" },
    }
  },
  report: async () => ({ ok: true as const }),

  revealPhone: async (id: string) => ({
    ok: true as const,
    data: { phoneNumber: "+910000000000", revealCount: 2 },
  }),

  async createTask(payload: Partial<Task>) {
    await wait(120)
    const newTask: Task = {
      id: `T-MOCK-${dummyTasks.length + 1}`,
      status: "PENDING",
      createdAt: payload.createdAt ?? new Date().toISOString(),
      voiceUrl: payload.voiceUrl ?? "",
      description: payload.description ?? "",
      latitude: payload.latitude ?? 0,
      longitude: payload.longitude ?? 0,
      radiusMeters: payload.radiusMeters ?? 1,
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

  async cancelTask(id: string) {
    const t = dummyTasks.find((x) => String(x.id) === String(id))
    if (t) t.status = "CANCELLED"
    return { ok: true as const }
  },

  async releaseTask(id: string) {
    const t = dummyTasks.find((x) => String(x.id) === String(id))
    if (t) {
      t.status = "OPEN"
      t.helperId = null
    }
    return { ok: true as const }
  },

  async reassignTask(id: string) {
    const t = dummyTasks.find((x) => String(x.id) === String(id))
    if (t) {
      t.status = "OPEN"
      t.helperId = null
    }
    return { ok: true as const }
  },

  addReview: async () => ({ ok: true as const }),
  report: async () => ({ ok: true as const }),
  registerDevice: async () => ({ ok: true as const }),

  // --- Phase 1: Auth / OTP mock endpoints ---
  async requestOtp(phone: string) {
    await wait(150)
    // store mock OTP in memory so verify can pass
    _setMockOtp(phone)
    return { ok: true as const, data: { message: "otp_sent" } }
  },

  async verifyOtp(payload: { phone: string; code: string; displayName?: string; email?: string }) {
    await wait(150)
    const { phone, code } = payload
    if (_isOtpValid(phone, code)) {
      return {
        ok: true as const,
        data: {
          accessToken: "MOCK_ACCESS_TOKEN",
          refreshToken: "MOCK_REFRESH_TOKEN",
        },
      }
    }
    return { ok: false as const, data: { error: "invalid_or_expired_otp" } }
  },

  async me() {
    await wait(80)
    return {
      ok: true as const,
      data: {
        id: "U-MOCK-1",
        phone: _lastOtpPhone ?? "+910000000000",
        email: "mock@example.com",
        displayName: "You",
        roles: "USER",
        languages: "en,hi,mr",
      },
    }
  },
}
