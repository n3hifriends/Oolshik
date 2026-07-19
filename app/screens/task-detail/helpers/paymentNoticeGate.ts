import { loadString, saveString } from "@/utils/storage"

export const PAYMENT_NOTICE_VERSION = "v1"
const PAYMENT_NOTICE_KEY_PREFIX = `payment_disclaimer_seen_${PAYMENT_NOTICE_VERSION}`

export type PaymentNoticeIntent = "pay" | "collect"

function resolveScope(userId?: string | null): string {
  const normalized = String(userId ?? "").trim()
  return normalized.length > 0 ? normalized : "device"
}

// "pay" keeps the pre-existing unsuffixed key so users who already dismissed
// the pay-direction notice aren't shown it again. "collect" is a distinct
// direction with different copy, so it gets its own one-time state.
export function paymentNoticeSeenKey(
  userId?: string | null,
  intent: PaymentNoticeIntent = "pay",
): string {
  const scope = resolveScope(userId)
  return intent === "collect"
    ? `${PAYMENT_NOTICE_KEY_PREFIX}:${scope}:collect`
    : `${PAYMENT_NOTICE_KEY_PREFIX}:${scope}`
}

export function hasSeenPaymentNoticeWithStorage(
  readString: (key: string) => string | null,
  userId?: string | null,
  intent: PaymentNoticeIntent = "pay",
): boolean {
  return readString(paymentNoticeSeenKey(userId, intent)) === "1"
}

export function markPaymentNoticeSeenWithStorage(
  writeString: (key: string, value: string) => boolean,
  userId?: string | null,
  intent: PaymentNoticeIntent = "pay",
): boolean {
  return writeString(paymentNoticeSeenKey(userId, intent), "1")
}

export function hasSeenPaymentNotice(
  userId?: string | null,
  intent: PaymentNoticeIntent = "pay",
): boolean {
  return hasSeenPaymentNoticeWithStorage(loadString, userId, intent)
}

export function markPaymentNoticeSeen(
  userId?: string | null,
  intent: PaymentNoticeIntent = "pay",
): boolean {
  return markPaymentNoticeSeenWithStorage(saveString, userId, intent)
}
