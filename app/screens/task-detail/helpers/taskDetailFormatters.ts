import { formatDistanceLabel } from "@/utils/distance"

export type TranslateFn = (key: string, options?: Record<string, unknown>) => string

export function getInitials(name?: string) {
  if (!name) return "👤"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

export function minsAgo(iso: string | undefined, t: TranslateFn) {
  if (!iso) return ""
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const mins = Math.max(0, Math.round(diffMs / 60000))

  if (mins < 1) return t("oolshik:relativeTime.justNow")
  if (mins === 1) return t("oolshik:relativeTime.oneMinAgo")
  if (mins < 60) return t("oolshik:relativeTime.minsAgo", { count: mins })
  const hrs = Math.round(mins / 60)
  if (hrs === 1) return t("oolshik:relativeTime.oneHrAgo")
  if (hrs < 24) return t("oolshik:relativeTime.hrsAgo", { count: hrs })

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function paymentExpiryText(iso: string | null | undefined, t: TranslateFn) {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const diffMs = date.getTime() - Date.now()
  const absMs = Math.abs(diffMs)
  const mins = Math.round(absMs / 60000)

  if (diffMs >= 0) {
    if (mins < 1) return t("payment:pay.expiry.expiresSoon")
    if (mins === 1) return t("payment:pay.expiry.expiresInOneMin")
    if (mins < 60) return t("payment:pay.expiry.expiresInMins", { count: mins })
    const hrs = Math.round(mins / 60)
    if (hrs === 1) return t("payment:pay.expiry.expiresInOneHr")
    if (hrs < 24) return t("payment:pay.expiry.expiresInHrs", { count: hrs })
    return t("payment:pay.expiry.expiresOn", {
      date: date.toLocaleString(undefined, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    })
  }

  if (mins < 1) return t("payment:pay.expiry.expiredNow")
  if (mins === 1) return t("payment:pay.expiry.expiredOneMin")
  if (mins < 60) return t("payment:pay.expiry.expiredMins", { count: mins })
  const hrs = Math.round(mins / 60)
  if (hrs === 1) return t("payment:pay.expiry.expiredOneHr")
  if (hrs < 24) return t("payment:pay.expiry.expiredHrs", { count: hrs })
  return t("payment:pay.expiry.expiredOn", {
    date: date.toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
  })
}

export function maskPhoneNumber(input?: string) {
  if (!input) return ""
  const digits = input.replace(/\D/g, "")
  if (digits.length <= 4) return input

  const last4 = digits.slice(-4)
  let remainingToMask = Math.max(0, digits.length - 4)
  let lastIdx = 0
  let output = ""

  for (const ch of input) {
    if (/\d/.test(ch)) {
      if (remainingToMask > 0) {
        output += "*"
        remainingToMask -= 1
      } else {
        output += last4[lastIdx++] ?? ch
      }
    } else {
      output += ch
    }
  }

  return output
}

export function paymentStatusLabel(value: string | null | undefined, t: (key: string) => string) {
  const status = (value || "").toUpperCase()
  switch (status) {
    case "PENDING":
      return t("payment:pay.status.pending")
    case "INITIATED":
      return t("payment:pay.status.initiated")
    case "PAID_MARKED":
      return t("payment:pay.status.paidMarked")
    case "DISPUTED":
      return t("payment:pay.status.disputed")
    case "EXPIRED":
      return t("payment:pay.status.expired")
    default:
      return status || t("payment:pay.status.default")
  }
}

export function sanitizePaymentAmountInput(value: string) {
  const cleaned = value.replace(/[^0-9.]/g, "")
  const firstDot = cleaned.indexOf(".")
  if (firstDot < 0) return cleaned

  const intPart = cleaned.slice(0, firstDot + 1)
  const fracPart = cleaned
    .slice(firstDot + 1)
    .replace(/\./g, "")
    .slice(0, 2)

  return `${intPart}${fracPart}`
}

export function formatCountdown(ms: number | null) {
  if (ms == null) return null
  const totalSeconds = Math.ceil(ms / 1000)
  const mins = String(Math.floor(totalSeconds / 60)).padStart(2, "0")
  const secs = String(totalSeconds % 60).padStart(2, "0")
  return `${mins}:${secs}`
}

export function formatDistance(distanceMtr: number | undefined, t: TranslateFn) {
  return formatDistanceLabel(distanceMtr, t)
}
