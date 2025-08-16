import { create } from "apisauce"
import Config from "@/config"

const api = create({
  baseURL: Config.API_URL || "http://localhost:8080",
  timeout: 10000,
  headers: { "Content-Type": "application/json" },
})

export type Task = {
  id: string
  voiceUrl: string
  description?: string
  lat: number
  lng: number
  radiusKm: number
  status: "PENDING" | "ASSIGNED" | "COMPLETED"
  distanceKm?: number
  createdBy?: string
  assignedTo?: string | null
  createdById?: string
  createdByName?: string
  createdAt?: string // ISO
}

export const OolshikApi = {
  // Create Task
  createTask: (payload: {
    voiceUrl: string
    description?: string
    lat: number
    lng: number
    radiusKm: number
  }) => api.post("/tasks", payload),

  // Nearby
  nearbyTasks: (lat: number, lng: number, radiusKm: number) =>
    api.get<Task[]>("/tasks/nearby", { lat, lng, radiusKm }),

  // Accept
  acceptTask: (taskId: string) => api.post(`/tasks/${taskId}/accept`, {}),

  // Complete
  completeTask: (taskId: string) => api.post(`/tasks/${taskId}/complete`, {}),

  // Reviews
  addReview: (payload: { taskId: string; rating: number; comment?: string }) =>
    api.post("/reviews", payload),

  // Reports
  report: (payload: { targetUserId?: string; taskId?: string; reason: string; text?: string }) =>
    api.post("/reports", payload),

  // Device token (push)
  registerDevice: (token: string) => api.post("/users/device", { token }),

  // Media: ask backend for a pre-signed URL
  getPresigned: (contentType: string) =>
    api.post<{ uploadUrl: string; fileUrl: string }>("/media/pre-signed", { contentType }),
}
