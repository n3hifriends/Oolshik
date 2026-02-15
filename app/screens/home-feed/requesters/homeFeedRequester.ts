import { OolshikApi } from "@/api"
import type { Task } from "@/api/client"
import { uploadAudioSmart } from "@/audio/uploadAudio"
import { getProfileExtras } from "@/features/profile/storage/profileExtrasStore"
import type { VoiceNote } from "@/screens/home-feed/types"

type ApiLikeResponse<T> = {
  ok?: boolean
  status?: number
  data?: T | null
  problem?: string | null
  originalError?: {
    message?: string
  } | null
}

type MessageLike = {
  message?: unknown
}

function extractMessageFromData(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const message = (data as MessageLike).message
  return typeof message === "string" ? message : undefined
}

export async function loadPreferredRadiusKm(): Promise<number | null> {
  const extras = await getProfileExtras()
  return extras.helperRadiusKm ?? null
}

export async function syncHelperLocation(latitude: number, longitude: number): Promise<boolean> {
  const res = (await OolshikApi.updateHelperLocation(latitude, longitude)) as ApiLikeResponse<unknown>
  return !!res?.ok
}

export async function uploadVoiceNote(voiceNote: VoiceNote) {
  return uploadAudioSmart({
    uri: voiceNote.filePath,
    filename: `voice_${Date.now()}.m4a`,
    mimeType: "audio/m4a",
    durationMs: voiceNote.durationSec * 1000,
  })
}

export type CreateTaskPayload = {
  title: string
  description?: string
  voiceUrl?: string
  latitude: number
  longitude: number
  radiusMeters: number
  createdById?: string
  createdByName?: string
  createdAt?: string
}

export async function createTask(payload: CreateTaskPayload) {
  const res = (await OolshikApi.createTask(payload)) as ApiLikeResponse<Task>
  return {
    ok: !!res?.ok,
    status: res?.status,
    data: res?.ok && res?.data ? res.data : null,
    message:
      extractMessageFromData(res?.data) ||
      (typeof res?.problem === "string" ? res.problem : undefined) ||
      res?.originalError?.message,
  }
}
