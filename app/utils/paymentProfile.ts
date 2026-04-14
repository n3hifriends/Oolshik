const UPI_ID_REGEX = /^[a-z0-9][a-z0-9._-]{1,127}@[a-z0-9][a-z0-9.-]{1,63}$/i

export function normalizeUpiId(value?: string | null) {
  if (!value) return ""
  return value.trim().toLowerCase()
}

export function isValidUpiId(value?: string | null) {
  const normalized = normalizeUpiId(value)
  return normalized.length > 0 && UPI_ID_REGEX.test(normalized)
}

export function maskUpiId(value?: string | null) {
  const normalized = normalizeUpiId(value)
  const atIndex = normalized.indexOf("@")
  if (!normalized || atIndex <= 0 || atIndex === normalized.length - 1) return "—"

  const handle = normalized.slice(0, atIndex)
  const provider = normalized.slice(atIndex + 1)
  const prefix = handle.slice(0, Math.min(2, handle.length))
  const suffix = handle.slice(-1)
  const stars =
    handle.length <= 3 ? "*".repeat(Math.max(1, handle.length - prefix.length)) : "*".repeat(Math.max(2, handle.length - 3))
  return `${prefix}${stars}${suffix}@${provider}`
}
