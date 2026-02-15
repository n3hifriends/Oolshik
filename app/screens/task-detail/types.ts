import type { PaymentRequestApiResponse, Task } from "@/api/client"

export type TaskDetailTask = Task & {
  distanceMtr?: number
  phoneNumber?: string
  helperPhone?: string
}

export type RecoveryAction = "cancel" | "release" | "reject"

export type ReasonModalState = {
  visible: boolean
  action?: RecoveryAction
  reasonCode?: string
  reasonText?: string
}

export type StatusPalette = {
  label: string
  bg: string
  fg: string
}

export type StatusPaletteMap = {
  PENDING: StatusPalette
  PENDING_AUTH: StatusPalette
  ASSIGNED: StatusPalette
  COMPLETED: StatusPalette
  CANCELLED: StatusPalette
}

export type ActivePayment = PaymentRequestApiResponse | null
