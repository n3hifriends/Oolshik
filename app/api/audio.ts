// app/api/audio.ts
// Uses your existing Apisauce client exported as OolshikApi from '@/api'.
// If you don't have OolshikApi, you can pass an apisauce instance to these fns.

import type { ApisauceInstance } from "apisauce"
// @ts-ignore - optional import depending on your project
import { OolshikApi as DefaultApi } from "@/api"

export type InitUploadReq = { filename: string; mimeType: string; size: number; requestId?: string }
export type InitUploadResp = { uploadId: string }
export type CompleteUploadReq = { uploadId: string; totalChunks: number; durationMs?: number; sampleRate?: number }

const getApi = (api?: ApisauceInstance) => api || (DefaultApi as ApisauceInstance)

export const initUpload = (payload: InitUploadReq, api?: ApisauceInstance) =>
  getApi(api).post<InitUploadResp>("/media/audio/init", payload)

export const uploadChunk = (uploadId: string, chunkIndex: number, bytes: Uint8Array, api?: ApisauceInstance) =>
  getApi(api).put(`/media/audio/${uploadId}/chunk?index=${chunkIndex}`, bytes, {
    headers: { "Content-Type": "application/octet-stream" },
  })

export const completeUpload = (payload: CompleteUploadReq, api?: ApisauceInstance) =>
  getApi(api).post("/media/audio/complete", payload)

export const listMyRecordings = (api?: ApisauceInstance) => getApi(api).get("/media/audio/my")
export const deleteRecording = (id: string, api?: ApisauceInstance) => getApi(api).delete(`/media/audio/${id}`)
export const streamUrl = (id: string) =>
  `${process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api"}/media/audio/${id}/stream`

// Phase 2 (optional): Direct S3 Multipart (presigned) flow
export type MpuCreateResp = { uploadId: string; objectKey: string }
export type MpuPart = { partNumber: number; url: string }
export type MpuCompleteReq = { uploadId: string; objectKey: string; parts: { partNumber: number; eTag: string }[] }

export const mpuCreate = (filename: string, mimeType = "audio/m4a", api?: ApisauceInstance) =>
  getApi(api).post<MpuCreateResp>("/media/audio/mpu/create", { filename, mimeType })

export const mpuSignPart = (uploadId: string, objectKey: string, partNumber: number, api?: ApisauceInstance) =>
  getApi(api).post<MpuPart>("/media/audio/mpu/sign-part", { uploadId, objectKey, partNumber })

export const mpuComplete = (data: MpuCompleteReq, api?: ApisauceInstance) =>
  getApi(api).post("/media/audio/mpu/complete", data)

export const mpuAbort = (uploadId: string, objectKey: string, api?: ApisauceInstance) =>
  getApi(api).post("/media/audio/mpu/abort", { uploadId, objectKey })