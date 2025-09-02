// app/api/audio.ts
// Unified audio API helpers that plug into the existing Apisauce client and token/refresh stack.
// This module supports BOTH server-buffered chunk uploads and (optional) presigned S3 multipart.

import type { ApisauceInstance } from "apisauce"
import { api as DefaultApi } from "@/api/client"

export type InitUploadReq = { filename: string; mimeType: string; size: number; requestId: string }
export type InitUploadResp = { uploadId: string }
export type CompleteUploadReq = {
  uploadId: string
  totalChunks: number
  durationMs?: number
  sampleRate?: number
}

const getApi = (maybe?: ApisauceInstance) => (maybe ? maybe : (DefaultApi as ApisauceInstance))

// ---------- Phase 1: server-buffered chunk upload ----------
export const initUpload = (payload: InitUploadReq, a?: ApisauceInstance) =>
  getApi(a).post<InitUploadResp>("/media/audio/init", payload)

export const uploadChunk = (
  uploadId: string,
  chunkIndex: number,
  bytes: Uint8Array,
  a?: ApisauceInstance,
) =>
  getApi(a).put(`/media/audio/${uploadId}/chunk?index=${chunkIndex}` as any, bytes, {
    headers: { "Content-Type": "application/octet-stream" },
  })

export const completeUpload = (payload: CompleteUploadReq, a?: ApisauceInstance) =>
  getApi(a).post("/media/audio/complete", payload)

export const listMyRecordings = (a?: ApisauceInstance) => getApi(a).get("/media/audio/my")
export const deleteRecording = (id: string, a?: ApisauceInstance) =>
  getApi(a).delete(`/media/audio/${id}`)

export const streamUrl = (id: string, a?: ApisauceInstance) => {
  const base = getApi(a)?.getBaseURL?.() || ""
  // Ensure single slash join
  const trimmed = base.replace(/\/+$/, "")
  return `${trimmed}/media/audio/${id}/stream`
}

// ---------- Phase 2: direct-to-S3 multipart (optional) ----------
export type MpuCreateResp = { uploadId: string; objectKey: string }
export type MpuPart = { partNumber: number; url: string }
export type MpuCompleteReq = {
  uploadId: string
  objectKey: string
  parts: { partNumber: number; eTag: string }[]
}

export const mpuCreate = (filename: string, mimeType = "audio/m4a", a?: ApisauceInstance) =>
  getApi(a).post<MpuCreateResp>("/media/audio/mpu/create", { filename, mimeType })

export const mpuSignPart = (
  uploadId: string,
  objectKey: string,
  partNumber: number,
  a?: ApisauceInstance,
) => getApi(a).post<MpuPart>("/media/audio/mpu/sign-part", { uploadId, objectKey, partNumber })

export const mpuComplete = (data: MpuCompleteReq, a?: ApisauceInstance) =>
  getApi(a).post("/media/audio/mpu/complete", data)

export const mpuAbort = (uploadId: string, objectKey: string, a?: ApisauceInstance) =>
  getApi(a).post("/media/audio/mpu/abort", { uploadId, objectKey })

// ---------- Utility: tiny guard to validate Apisauce responses ----------
export function ensureOk<T = any>(res: { ok?: boolean; status?: number; data?: T }) {
  if (!res || res.ok !== true) {
    const code = (res && res.status) || "NO_STATUS"
    throw new Error(`Request failed (${code})`)
  }
  return res.data as T
}
