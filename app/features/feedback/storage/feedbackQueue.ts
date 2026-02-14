import React from "react"
import { AppState, Platform } from "react-native"
import * as Application from "expo-application"
import * as Localization from "expo-localization"

import { OolshikApi } from "@/api"
import { load, save, loadString, saveString } from "@/utils/storage"
import type { FeedbackCreateInput, FeedbackPayload } from "@/features/feedback/types"

const FEEDBACK_QUEUE_KEY = "feedback.queue.v1"
const FEEDBACK_SUBMITTED_PREFIX = "feedback.submitted.v1."
const FEEDBACK_SUBMITTED_DATA_PREFIX = "feedback.submitted.data.v1."

const BASE_BACKOFF_MS = 5000
const MAX_BACKOFF_MS = 5 * 60 * 1000

export type FeedbackQueueItem = {
  id: string
  idempotencyKey: string
  payload: FeedbackPayload
  attemptCount: number
  nextAttemptAt: number
  createdAt: number
}

export type SubmittedFeedbackSnapshot = {
  rating?: number
  tags?: string[]
  message?: string
  submittedAt: string
}

type SubmitResult = { ok: boolean; queued?: boolean; id?: string; error?: string }

let isFlushing = false

function generateKey(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 10)
  return `${prefix}_${Date.now().toString(36)}_${rand}`
}

function computeNextAttempt(attemptCount: number) {
  const next = BASE_BACKOFF_MS * Math.pow(2, Math.min(attemptCount, 6))
  return Date.now() + Math.min(next, MAX_BACKOFF_MS)
}

function getDeviceInfo(includeDeviceInfo?: boolean): Pick<
  FeedbackPayload,
  "appVersion" | "os" | "deviceModel" | "locale"
> {
  const locale = Localization.locale

  if (!includeDeviceInfo) {
    return { locale }
  }

  const version = Application.nativeApplicationVersion ?? ""
  const build = Application.nativeBuildVersion
  const appVersion = build ? `${version} (${build})` : version

  const osVersion = Platform.Version != null ? String(Platform.Version) : undefined
  const os = `${Platform.OS}${osVersion ? ` ${osVersion}` : ""}`

  const deviceModel =
    (Platform as any)?.constants?.Model ??
    (Platform as any)?.constants?.model ??
    (Platform as any)?.constants?.deviceName

  return {
    locale,
    appVersion: appVersion || undefined,
    os: os || undefined,
    deviceModel: deviceModel || undefined,
  }
}

function buildPayload(input: FeedbackCreateInput): FeedbackPayload {
  const payload: FeedbackPayload = {
    feedbackType: input.feedbackType,
    contextType: input.contextType,
    contextId: input.contextId,
    rating: input.rating,
    tags: input.tags?.filter(Boolean),
    message: input.message?.trim() || undefined,
    ...getDeviceInfo(input.includeDeviceInfo),
  }

  if (!payload.tags?.length) delete payload.tags
  if (!payload.message) delete payload.message
  if (payload.rating == null) delete payload.rating
  if (!payload.contextId) delete payload.contextId

  return payload
}

function loadQueue(): FeedbackQueueItem[] {
  return load<FeedbackQueueItem[]>(FEEDBACK_QUEUE_KEY) ?? []
}

function saveQueue(items: FeedbackQueueItem[]) {
  save(FEEDBACK_QUEUE_KEY, items)
}

function isRetryable(res: any) {
  if (!res) return true
  const status = res.status
  const problem = res.problem
  if (problem === "NETWORK_ERROR" || problem === "TIMEOUT_ERROR") return true
  if (status === 401) return true
  if (status != null && status >= 500) return true
  return false
}

async function sendFeedback(payload: FeedbackPayload, idempotencyKey: string) {
  return OolshikApi.createFeedback(payload, idempotencyKey)
}

export async function submitFeedback(input: FeedbackCreateInput): Promise<SubmitResult> {
  const idempotencyKey = generateKey("fbk")
  const payload = buildPayload(input)

  try {
    const res = await sendFeedback(payload, idempotencyKey)
    if (res?.ok) {
      return { ok: true, id: (res.data as any)?.id }
    }
    if (!isRetryable(res)) {
      return { ok: false, error: res?.data?.message || res?.problem || "Submit failed" }
    }
  } catch (e: any) {
    // fall through to queue
  }

  const item: FeedbackQueueItem = {
    id: generateKey("fbq"),
    idempotencyKey,
    payload,
    attemptCount: 0,
    nextAttemptAt: Date.now() + BASE_BACKOFF_MS,
    createdAt: Date.now(),
  }
  const next = [...loadQueue(), item]
  saveQueue(next)

  return { ok: false, queued: true, error: "queued" }
}

export async function flushFeedbackQueue() {
  if (isFlushing) return
  isFlushing = true
  try {
    const now = Date.now()
    const queue = loadQueue()
    if (!queue.length) return

    const remaining: FeedbackQueueItem[] = []

    for (const item of queue) {
      if (item.nextAttemptAt > now) {
        remaining.push(item)
        continue
      }

      let res: any = null
      try {
        res = await sendFeedback(item.payload, item.idempotencyKey)
      } catch (e: any) {
        res = null
      }

      if (res?.ok || res?.status === 409) {
        continue
      }

      if (!isRetryable(res)) {
        continue
      }

      const attemptCount = item.attemptCount + 1
      remaining.push({
        ...item,
        attemptCount,
        nextAttemptAt: computeNextAttempt(attemptCount),
      })
    }

    saveQueue(remaining)
  } finally {
    isFlushing = false
  }
}

export function hasSubmittedFeedback(key: string) {
  return loadString(`${FEEDBACK_SUBMITTED_PREFIX}${key}`) === "1"
}

export function markSubmittedFeedback(key: string) {
  saveString(`${FEEDBACK_SUBMITTED_PREFIX}${key}`, "1")
}

export function saveSubmittedFeedbackSnapshot(key: string, snapshot: SubmittedFeedbackSnapshot) {
  save(`${FEEDBACK_SUBMITTED_DATA_PREFIX}${key}`, snapshot)
}

export function getSubmittedFeedbackSnapshot(key: string): SubmittedFeedbackSnapshot | null {
  return load<SubmittedFeedbackSnapshot>(`${FEEDBACK_SUBMITTED_DATA_PREFIX}${key}`)
}

export function useFeedbackQueue() {
  React.useEffect(() => {
    let mounted = true

    const runFlush = () => {
      if (!mounted) return
      void flushFeedbackQueue()
    }

    runFlush()
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") runFlush()
    })

    return () => {
      mounted = false
      sub.remove()
    }
  }, [])

  return { submitFeedback, flushFeedbackQueue }
}
