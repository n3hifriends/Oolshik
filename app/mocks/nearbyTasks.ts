export type MockTask = {
  id: string
  voiceUrl?: string | null
  description?: string
  distanceMtr?: number
  status: "PENDING" | "ASSIGNED" | "COMPLETED"
  createdById: string
  createdByName: string
  createdAt?: string // 10 min ago
}

export const MOCK_NEARBY_TASKS: MockTask[] = [
  {
    id: "T-1001",
    description: "Switch on motor",
    distanceMtr: 0.3,
    status: "PENDING",
    voiceUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    createdById: "U-01",
    createdByName: "Amit",
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
  },
  {
    id: "T-1002",
    description: "Bring 1L milk",
    distanceMtr: 0.9,
    status: "PENDING",
    voiceUrl: null,
    createdById: "U-01",
    createdByName: "Rahul",
    createdAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 10 min ago
  },
  {
    id: "T-1003",
    description: "Parcel pickup at main gate",
    distanceMtr: 1.6,
    status: "PENDING",
    voiceUrl: null,
    createdById: "U-01",
    createdByName: "Sagar",
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 10 min ago
  },
  {
    id: "T-1004",
    description: "Need help lifting a box",
    distanceMtr: 2.4,
    status: "PENDING",
    voiceUrl: null,
    createdById: "U-01",
    createdByName: "Gorakh",
    createdAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(), // 10 min ago
  },
]
