// app/audio/uploadAudio.ts
import * as FileSystem from "expo-file-system"
import { api as Api } from "@/api/client"
import { initUpload, uploadChunk, completeUpload, ensureOk } from "@/api/audio"

const CHUNK_SIZE = 5 * 1024 * 1024

export async function uploadAudioSmart(opts: {
  uri: string
  filename?: string
  mimeType?: string
  durationMs?: number
  sampleRate?: number
}) {
  const mimeType = opts.mimeType ?? "audio/m4a"
  const filename = opts.filename ?? `recording_${Date.now()}.m4a`

  // 1) Try presigned PUT first (S3 mode)
  try {
    const pres = await Api.post<{ uploadUrl: string; fileUrl: string; objectKey: string }>(
      "/media/pre-signed",
      { contentType: mimeType },
    )
    if (pres.ok && pres.data) {
      const { uploadUrl, fileUrl } = pres.data
      const up = await FileSystem.uploadAsync(uploadUrl, opts.uri, {
        httpMethod: "PUT",
        headers: { "Content-Type": mimeType },
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      })
      if (up.status >= 200 && up.status < 300) {
        return { ok: true as const, url: fileUrl }
      }
      // Fallthrough to chunked if PUT failed
    }
  } catch {
    // ignore and fall back
  }

  // 2) Fallback: server-buffered chunk upload (works in local mode)
  const stat = await FileSystem.getInfoAsync(opts.uri, { size: true })
  if (!stat.exists || typeof stat.size !== "number") {
    throw new Error("Audio file not found")
  }
  const size = stat.size

  const init = await initUpload({ filename, mimeType, size })
  const initData = ensureOk<{ uploadId: string }>(init)
  const uploadId = initData.uploadId

  let offset = 0
  let index = 0
  while (offset < size) {
    const length = Math.min(CHUNK_SIZE, size - offset)
    const { uri: sliceUri } = await FileSystem.downloadAsync(
      // NOTE: FileSystem doesn’t slice local files; read base64 then convert is expensive.
      // Better: use readAsStringAsync with base64 and convert:
      opts.uri,
      opts.uri, // no-op, we’ll read base64 below; kept for clarity
    )
    // Efficient base64 read:
    const b64 = await FileSystem.readAsStringAsync(opts.uri, {
      encoding: FileSystem.EncodingType.Base64,
      position: offset,
      length,
    } as any) // position/length are supported in RNFS; Expo may need a polyfill. If not supported, use RNFS instead.

    const bytes = base64ToBytes(b64)
    const res = await uploadChunk(uploadId, index, bytes as unknown as Uint8Array)
    if (!res.ok) throw new Error(`Chunk ${index} failed`)
    offset += length
    index++
  }

  const comp = await completeUpload({
    uploadId,
    totalChunks: index,
    durationMs: opts.durationMs,
    sampleRate: opts.sampleRate,
  })
  if (!comp.ok) throw new Error("Complete upload failed")

  // For chunked uploads, you usually play via stream endpoint using the ID,
  // but your current CreateTask flow expects a URL.
  // Easiest is to store the returned entity's stream URL server-side; however our /complete returns an entity.
  // If your controller returns the saved AudioFile, you can derive the URL client-side:
  const saved = comp.data as any
  const base = (Api as any).getBaseURL?.() || ""
  const url = `${String(base).replace(/\/+$/, "")}/media/audio/${saved.id}/stream`
  return { ok: true as const, url }
}

function base64ToBytes(b64: string) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  let i = 0
  const out = []
  for (; i < b64.length; ) {
    const c1 = chars.indexOf(b64[i++])
    const c2 = chars.indexOf(b64[i++])
    const c3 = chars.indexOf(b64[i++])
    const c4 = chars.indexOf(b64[i++])
    const n1 = (c1 << 2) | (c2 >> 4)
    const n2 = ((c2 & 15) << 4) | (c3 >> 2)
    const n3 = ((c3 & 3) << 6) | c4
    out.push(n1)
    if (c3 !== 64) out.push(n2)
    if (c4 !== 64) out.push(n3)
  }
  return Uint8Array.from(out)
}
