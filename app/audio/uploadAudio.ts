// app/audio/uploadAudio.ts
import RNFS from "react-native-fs"
import { api as Api } from "@/api/client"
import { initUpload, uploadChunk, completeUpload, ensureOk, streamUrl } from "@/api/audio"

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB

type Opts = {
  uri: string // file://...
  filename?: string // defaults to recording_<ts>.m4a
  mimeType?: string // defaults to audio/m4a
  durationMs?: number
  sampleRate?: number
}

/**
 * Uploads audio:
 * - tries S3 presigned PUT first (if backend supports it),
 * - otherwise falls back to server-buffered chunk upload (works on media.storage=local).
 * Returns a URL your app can play (S3 public URL OR backend /stream URL).
 */
export async function uploadAudioSmart(opts: Opts): Promise<{ ok: true; url: string }> {
  const mimeType = opts.mimeType ?? "audio/m4a"
  const filename = opts.filename ?? `recording_${Date.now()}.m4a`

  // Try presigned S3 first (will 501/500 on local → we catch and fallback)
  try {
    const pres = await Api.post<{ uploadUrl: string; fileUrl: string; objectKey: string }>(
      "/media/pre-signed",
      { contentType: mimeType },
    )
    if (pres.ok && pres.data) {
      const { uploadUrl, fileUrl } = pres.data
      // Upload file as binary (no base64) using RNFS
      const stat = await RNFS.stat(opts.uri.replace("file://", ""))
      const data = await RNFS.readFile(opts.uri, "base64")
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": mimeType },
        body: Buffer.from(data, "base64") as any,
      })
      if (!res.ok) throw new Error(`PUT failed ${res.status}`)
      return { ok: true, url: fileUrl }
    }
  } catch {
    // ignore; fall back to chunked
  }

  // ---- Fallback: server-buffered chunk upload (LOCAL) ----
  // 1) stat
  const filePath = opts.uri.startsWith("file://") ? opts.uri.replace("file://", "") : opts.uri
  const st = await RNFS.stat(filePath)
  const size = Number(st.size)
  if (!Number.isFinite(size) || size <= 0) throw new Error("File not found or empty")

  // 2) init
  const initRes = await initUpload({ filename, mimeType, size })
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
  const saved: any = comp.data

  // 5) build play URL via the same base used by client/api
  const url = streamUrl(saved.id) // e.g. http://.../api/media/audio/{id}/stream
  return { ok: true, url }
}

function base64ToBytes(b64: string): Uint8Array {
  // fast base64 decoder (no atob dependency)
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  let i = 0,
    out: number[] = []
  b64 = b64.replace(/[^A-Za-z0-9+/=]/g, "")
  while (i < b64.length) {
    const e1 = chars.indexOf(b64[i++])
    const e2 = chars.indexOf(b64[i++])
    const e3 = chars.indexOf(b64[i++])
    const e4 = chars.indexOf(b64[i++])
    const c1 = (e1 << 2) | (e2 >> 4)
    const c2 = ((e2 & 15) << 4) | (e3 >> 2)
    const c3 = ((e3 & 3) << 6) | e4
    out.push(c1)
    if (e3 !== 64) out.push(c2)
    if (e4 !== 64) out.push(c3)
  }
  return Uint8Array.from(out)
}
