import type { ViewMode } from "@/components/Segmented"
import type { Status } from "@/hooks/useTaskFiltering"
import type { Task } from "@/api/client"

export type Radius = 1 | 2 | 5

export type LocationStatus = "idle" | "loading" | "ready" | "denied" | "error"

export type HomeFeedTask = Task & {
  distanceMtr?: number
  createdById?: string
  requesterName?: string
  phoneNumber?: string
}

export type SubmitMode = "voice" | "type"

export type VoiceNote = {
  filePath: string
  durationSec: number
}

export type SubmitTaskInput = {
  text: string
  mode: SubmitMode
  voiceNote?: VoiceNote
}

export type TranslateFn = (key: string, options?: Record<string, unknown>) => string

export type HomeFeedViewMode = ViewMode

export type HomeFeedStatus = Status
