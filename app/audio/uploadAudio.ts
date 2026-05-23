// app/audio/uploadAudio.ts
import RNFS from "react-native-fs"

import {
  initUpload,
  uploadChunk,
  completeUpload,
  ensureOk,
  publicStreamUrl,
  streamUrl,
} from "@/api/audio"
import { api as Api } from "@/api/client"
import Config from "@/config"

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB
const PRESIGN_RETRY_COOLDOWN_MS = 10 * 60 * 1000
const PRESIGNED_UPLOAD_REQUIRED_MESSAGE =
  "Voice upload requires S3 presigned upload in this environment. Check /api/media/pre-signed and S3 media configuration."
let presignState: "unknown" | "supported" | "unsupported" = "unknown"
let lastPresignAttemptAt = 0

type Opts = {
  uri: string // file://...
  filename: string // defaults to recording_<ts>.m4a
  mimeType: string // defaults to audio/m4a
  durationMs: number
  sampleRate?: number
  requestId?: string // optional client-provided upload ID (for deduping)
}

type AudioUploadResult = {
  ok: true
  url: string
  audioFileId: string
}

type PresignResponse = {
  uploadUrl: string
  fileUrl: string
  objectKey: string
}

type AudioFileResponse = {
  id?: string
}

/**
 * Uploads audio:
 * - tries S3 presigned PUT first (if backend supports it),
 * - otherwise falls back to server-buffered chunk upload (works on media.storage=local).
 * Returns the registered AudioFile id plus a playback URL.
 */
export async function uploadAudioSmart(opts: Opts): Promise<AudioUploadResult> {
  const mimeType = opts.mimeType ?? "audio/m4a"
  const filename = opts.filename ?? `recording_${Date.now()}.m4a`
  const requestId = buildUploadRequestId(opts.requestId)
  const filePath = toFilePath(opts.uri)
  let presignFailureMessage: string | null = null

  const shouldTryPresign =
    Config.REQUIRE_PRESIGNED_AUDIO_UPLOAD ||
    presignState !== "unsupported" ||
    Date.now() - lastPresignAttemptAt > PRESIGN_RETRY_COOLDOWN_MS

  // Try presigned S3 first (fallback to chunked on failure)
  if (shouldTryPresign) {
    try {
      lastPresignAttemptAt = Date.now()
      const pres = await Api.post<PresignResponse>("/media/pre-signed", { contentType: mimeType })
      if (pres.ok && pres.data) {
        presignState = "supported"
        const { uploadUrl, fileUrl, objectKey } = pres.data
        // Upload file as binary (no base64) using RNFS
        const data = await RNFS.readFile(filePath, "base64")
        const bytes = base64ToBytes(data)
        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": mimeType },
          body: bytes as any,
        })
        if (!res.ok) throw new Error(`PUT failed ${res.status}`)
        const complete = await Api.post<AudioFileResponse>("/media/pre-signed/complete", {
          objectKey,
          filename,
          mimeType,
          durationMs: opts.durationMs,
          sampleRate: opts.sampleRate,
        })
        const saved = ensureOk<AudioFileResponse>(complete)
        const audioFileId = extractAudioFileId(saved)
        return { ok: true, url: fileUrl, audioFileId }
      }

      const presignResponse = pres as {
        status?: number
        data?: unknown
        problem?: string | null
        originalError?: { message?: string } | null
      }
      presignFailureMessage = formatPresignFailureMessage(
        presignResponse.status,
        extractErrorMessage(presignResponse.data) ??
          presignResponse.problem ??
          presignResponse.originalError?.message,
      )

      if (pres.status && [400, 404, 405, 500, 501].includes(pres.status)) {
        presignState = "unsupported"
      }
    } catch (error) {
      presignFailureMessage = formatThrownErrorMessage(error)
    }
  }

  if (Config.REQUIRE_PRESIGNED_AUDIO_UPLOAD) {
    throw new Error(presignFailureMessage ?? PRESIGNED_UPLOAD_REQUIRED_MESSAGE)
  }

  // ---- Fallback: server-buffered chunk upload (LOCAL) ----
  // 1) stat
  const st = await RNFS.stat(filePath)
  const size = Number(st.size)
  if (!Number.isFinite(size) || size <= 0) throw new Error("File not found or empty")

  // 2) init
  const initRes = await initUpload({ filename, mimeType, size, requestId })
  const initData = ensureOk<{ uploadId: string }>(initRes)
  const uploadId = initData.uploadId

  // 3) chunk loop
  let offset = 0
  let index = 0
  while (offset < size) {
    const len = Math.min(CHUNK_SIZE, size - offset)
    // RNFS read with length + position (base64 → bytes)
    const base64 = await RNFS.read(filePath, len, offset, "base64")
    const bytes = base64ToBytes(base64)
    const put = await uploadChunk(uploadId, index, bytes as unknown as Uint8Array)
    if (!put.ok) throw new Error(`Chunk ${index} failed`)
    offset += len
    index++
  }

  // 4) complete → server returns AudioFile (id, etc.)
  const comp = await completeUpload({
    uploadId,
    totalChunks: index,
    durationMs: opts.durationMs,
    sampleRate: opts.sampleRate,
  })
  if (!comp.ok || !comp.data) throw new Error("Complete upload failed")
  const saved = comp.data as AudioFileResponse
  const audioFileId = extractAudioFileId(saved)

  // 5) build play URL via the same base used by client/api
  const url = Config.LOCAL_AUDIO_PUBLIC_STREAM
    ? publicStreamUrl(audioFileId) // e.g. http://.../api/public/media/audio/{id}/stream
    : streamUrl(audioFileId) // e.g. http://.../api/media/audio/{id}/stream
  return { ok: true, url, audioFileId }
}

function buildUploadRequestId(existing?: string): string {
  const value = existing?.trim()
  if (value) return value

  const generatedByCrypto = globalThis.crypto?.randomUUID?.()
  if (generatedByCrypto) return generatedByCrypto

  return `audio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function toFilePath(uri: string): string {
  return uri.startsWith("file://") ? uri.replace("file://", "") : uri
}

function base64ToBytes(b64: string): Uint8Array {
  // fast base64 decoder (no atob dependency)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  let i = 0
  const out: number[] = []
  b64 = b64.replace(/[^A-Za-z0-9+/=]/g, "")
  while (i < b64.length) {
    const c1Raw = b64[i++]
    const c2Raw = b64[i++]
    const c3Raw = b64[i++]
    const c4Raw = b64[i++]
    const e1 = chars.indexOf(c1Raw)
    const e2 = chars.indexOf(c2Raw)
    const e3 = c3Raw === "=" ? 64 : chars.indexOf(c3Raw)
    const e4 = c4Raw === "=" ? 64 : chars.indexOf(c4Raw)
    const c1 = (e1 << 2) | (e2 >> 4)
    const c2 = ((e2 & 15) << 4) | (e3 >> 2)
    const c3 = ((e3 & 3) << 6) | e4
    out.push(c1)
    if (e3 !== 64) out.push(c2)
    if (e4 !== 64) out.push(c3)
  }
  return Uint8Array.from(out)
}

function extractAudioFileId(saved: AudioFileResponse): string {
  if (typeof saved.id === "string" && saved.id.trim().length > 0) {
    return saved.id
  }
  throw new Error("Audio upload completed without an audio file id")
}

function extractErrorMessage(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined

  const error = "error" in value ? value.error : undefined
  if (typeof error === "string" && error.trim().length > 0) return error

  const message = "message" in value ? value.message : undefined
  if (typeof message === "string" && message.trim().length > 0) return message

  return undefined
}

function formatPresignFailureMessage(status?: number, detail?: string | null) {
  const normalizedDetail = detail?.trim()
  if (normalizedDetail) {
    return `Voice upload could not start S3 presigned upload (${status ?? "NO_STATUS"}): ${normalizedDetail}`
  }
  if (status != null) {
    return `Voice upload could not start S3 presigned upload (${status}).`
  }
  return PRESIGNED_UPLOAD_REQUIRED_MESSAGE
}

function formatThrownErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return `Voice upload failed during S3 presigned upload: ${error.message}`
  }
  return PRESIGNED_UPLOAD_REQUIRED_MESSAGE
}
// curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0YTY3MDgzMy1jYWZkLTQyMTItYTlkYy1iOGRlNTFmM2I1MmYiLCJpYXQiOjE3NTY2NDM0NDIsImV4cCI6MTc1NjY0NzA0MiwidHlwIjoiYWNjZXNzIiwicGhvbmUiOiIrOTE5NzYyMjc5NjY3In0.hGYj-b-qzlYeZe7Usz9t0y11KamkVCpBwxABAH3oXls" \
//   http://localhost:8080/api/media/audio/my

//  curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI0YTY3MDgzMy1jYWZkLTQyMTItYTlkYy1iOGRlNTFmM2I1MmYiLCJpYXQiOjE3NTY2NDM0NDIsImV4cCI6MTc1NjY0NzA0MiwidHlwIjoiYWNjZXNzIiwicGhvbmUiOiIrOTE5NzYyMjc5NjY3In0.hGYj-b-qzlYeZe7Usz9t0y11KamkVCpBwxABAH3oXls" \
//      http://localhost:8080/api/media/audio/72da3149-7b0a-416b-9739-bdc6e6bb1914/stream \
//      --output sample.m4a
