import type { Task } from "./client"

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))

export const MockOolshikApi = {
  async getPresigned(_contentType: string) {
    await wait(100)
    return {
      ok: true,
      data: {
        uploadUrl: "https://mock.local/upload/123", // not used in mock mode
        fileUrl: "https://mock.local/files/123.m4a",
      } as { uploadUrl: string; fileUrl: string },
    }
  },

  async createTask(payload: Partial<Task>) {
    await wait(150)
    const now = new Date().toISOString()
    return {
      ok: true,
      data: {
        id: "T-MOCK-1001",
        status: "PENDING",
        distanceKm: 0.4,
        createdAt: payload.createdAt ?? now,
        createdById: payload.createdById ?? "U-LOCAL-1",
        createdByName: payload.createdByName ?? "You",
        ...payload,
      } as Task,
    }
  },

  // stubs to keep imports happy if used elsewhere
  acceptTask: async () => ({ ok: true }),
  completeTask: async () => ({ ok: true }),
  nearbyTasks: async () => ({ ok: true, data: [] as Task[] }),
  addReview: async () => ({ ok: true }),
  report: async () => ({ ok: true }),
  registerDevice: async () => ({ ok: true }),
  getPresignedImage: async () => ({ ok: true, data: { uploadUrl: "", fileUrl: "" } }),
}
