import type { HomeFeedStatus, Radius } from "@/screens/home-feed/types"

export const STATUS_ORDER: HomeFeedStatus[] = [
  "OPEN",
  "PENDING_AUTH",
  "ASSIGNED",
  "COMPLETED",
  "CANCELLED",
]

export const TITLE_REFRESH_COOLDOWN_MS = 5000

export const RADIUS_OPTIONS: Radius[] = [1, 2, 5]

export const normalizeStatus = (status?: string): HomeFeedStatus | null => {
  const raw = String(status ?? "").trim().toUpperCase()
  if (!raw) return null
  if (raw === "PENDING") return "OPEN"
  if (raw === "CANCELED") return "CANCELLED"
  if (
    raw === "OPEN" ||
    raw === "PENDING_AUTH" ||
    raw === "ASSIGNED" ||
    raw === "COMPLETED" ||
    raw === "CANCELLED"
  ) {
    return raw as HomeFeedStatus
  }
  return null
}

export const normalizeRadius = (value?: number | null): Radius => {
  if (value && RADIUS_OPTIONS.includes(value as Radius)) return value as Radius
  if (!value) return 1
  return RADIUS_OPTIONS.reduce((closest, current) =>
    Math.abs(current - value) < Math.abs(closest - value) ? current : closest,
  )
}

export function getInitials(name?: string, fallback?: string) {
  const source = (name || fallback || "").trim()
  if (!source) return "U"
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}
