import { OolshikApi } from "@/api"
import type { OfferUpdateApiResponse, PaymentRequestApiResponse, Task } from "@/api/client"

type ApiLikeResponse<T> = {
  ok: boolean
  data?: T | null
  status?: number
}

export type ReasonPayload = {
  reasonCode: string
  reasonText?: string
}

function extractMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined
  const maybeMessage = (data as { message?: unknown }).message
  return typeof maybeMessage === "string" ? maybeMessage : undefined
}

export async function fetchTaskById(taskId: string) {
  const res = (await OolshikApi.findTaskByTaskId(taskId)) as ApiLikeResponse<Task>
  return {
    ok: !!res?.ok,
    status: res?.status,
    data: res?.ok && res?.data ? res.data : null,
    message: extractMessage(res?.data),
  }
}

export async function fetchActivePaymentRequest(taskId: string) {
  const res = (await OolshikApi.getActivePaymentRequest(taskId)) as ApiLikeResponse<PaymentRequestApiResponse>
  return {
    ok: !!res?.ok,
    status: res?.status,
    data: res?.ok && res?.data ? res.data : null,
  }
}

export async function updateTaskOffer(
  taskId: string,
  payload: { offerAmount?: number | null; offerCurrency?: string },
) {
  const res = (await OolshikApi.updateTaskOffer(taskId, payload)) as ApiLikeResponse<OfferUpdateApiResponse>
  return {
    ok: !!res?.ok,
    status: res?.status,
    data: res?.ok && res?.data ? res.data : null,
    message: extractMessage(res?.data),
  }
}

export async function revealPhone(taskId: string) {
  const res = (await OolshikApi.revealPhone(taskId)) as ApiLikeResponse<{ phoneNumber?: string }>
  return {
    ok: !!res?.ok,
    status: res?.status,
    data: res?.ok && res?.data ? res.data : null,
    message: extractMessage(res?.data),
  }
}

export async function authorizeRequest(taskId: string) {
  const res = (await OolshikApi.authorizeRequest(taskId)) as ApiLikeResponse<Partial<Task>>
  return {
    ok: !!res?.ok,
    status: res?.status,
    data: res?.ok && res?.data ? res.data : null,
  }
}

export async function rejectRequest(taskId: string, payload: ReasonPayload) {
  const res = (await OolshikApi.rejectRequest(taskId, payload)) as ApiLikeResponse<Partial<Task>>
  return {
    ok: !!res?.ok,
    status: res?.status,
    data: res?.ok && res?.data ? res.data : null,
  }
}

export async function cancelTask(taskId: string, payload: ReasonPayload) {
  const res = (await OolshikApi.cancelTask(taskId, payload)) as ApiLikeResponse<Partial<Task>>
  return {
    ok: !!res?.ok,
    status: res?.status,
    data: res?.ok && res?.data ? res.data : null,
  }
}

export async function releaseTask(taskId: string, payload: ReasonPayload) {
  const res = (await OolshikApi.releaseTask(taskId, payload)) as ApiLikeResponse<Partial<Task>>
  return {
    ok: !!res?.ok,
    status: res?.status,
    data: res?.ok && res?.data ? res.data : null,
  }
}

export async function reassignTask(taskId: string) {
  const res = (await OolshikApi.reassignTask(taskId)) as ApiLikeResponse<Partial<Task>>
  return {
    ok: !!res?.ok,
    status: res?.status,
    data: res?.ok && res?.data ? res.data : null,
  }
}

export async function completeTask(taskId: string) {
  const res = (await OolshikApi.completeTask(taskId)) as ApiLikeResponse<unknown>
  return {
    ok: !!res?.ok,
    status: res?.status,
    data: res?.data,
    message: extractMessage(res?.data),
  }
}

export async function rateTask(taskId: string, payload: { rating: number; feedback?: string }) {
  const res = (await OolshikApi.rateTask(taskId, payload)) as ApiLikeResponse<unknown>
  return {
    ok: !!res?.ok,
    status: res?.status,
  }
}
