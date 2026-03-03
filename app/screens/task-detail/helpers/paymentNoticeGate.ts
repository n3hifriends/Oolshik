import { loadString, saveString } from "@/utils/storage"

export const PAYMENT_NOTICE_VERSION = "v1"
const PAYMENT_NOTICE_KEY_PREFIX = `payment_disclaimer_seen_${PAYMENT_NOTICE_VERSION}`

function resolveScope(userId?: string | null): string {
  const normalized = String(userId ?? "").trim()
  return normalized.length > 0 ? normalized : "device"
}

export function paymentNoticeSeenKey(userId?: string | null): string {
  return `${PAYMENT_NOTICE_KEY_PREFIX}:${resolveScope(userId)}`
}

export function hasSeenPaymentNoticeWithStorage(
  readString: (key: string) => string | null,
  userId?: string | null,
): boolean {
  return readString(paymentNoticeSeenKey(userId)) === "1"
}

export function markPaymentNoticeSeenWithStorage(
  writeString: (key: string, value: string) => boolean,
  userId?: string | null,
): boolean {
  return writeString(paymentNoticeSeenKey(userId), "1")
}

export function hasSeenPaymentNotice(userId?: string | null): boolean {
  return hasSeenPaymentNoticeWithStorage(loadString, userId)
}

export function markPaymentNoticeSeen(userId?: string | null): boolean {
  return markPaymentNoticeSeenWithStorage(saveString, userId)
}
