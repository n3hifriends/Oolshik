export type TaskStatus =
  | "OPEN"
  | "PENDING"
  | "PENDING_AUTH"
  | "ASSIGNED"
  | "WORK_DONE_PENDING_CONFIRMATION"
  | "REVIEW_REQUIRED"
  | "COMPLETED"
  | "CANCELLED"
  | "UNKNOWN"

export type StatusColorSet = {
  /** Soft badge/card background */
  bg: string
  /** Text/icon color on bg */
  fg: string
  /** Vivid solid accent — for chip border and active chip background */
  vivid: string
  /** Very soft chip background for inactive filter chips */
  softBg: string
  /** Text color on the vivid background (active chip). Dark for light vivids, white for dark vivids. */
  activeFg: string
}

type ColorMap = Record<string, StatusColorSet>

const LIGHT: ColorMap = {
  OPEN:                           { vivid: "#0EA5E9", softBg: "rgba(14,165,233,0.10)",  bg: "rgba(14,165,233,0.10)",  fg: "#0369A1", activeFg: "#fff" },
  PENDING:                        { vivid: "#0EA5E9", softBg: "rgba(14,165,233,0.10)",  bg: "rgba(14,165,233,0.10)",  fg: "#0369A1", activeFg: "#fff" },
  PENDING_AUTH:                   { vivid: "#2563EB", softBg: "rgba(37,99,235,0.10)",   bg: "rgba(37,99,235,0.10)",   fg: "#1D4ED8", activeFg: "#fff" },
  ASSIGNED:                       { vivid: "#F59E0B", softBg: "rgba(245,158,11,0.10)",  bg: "#FDE68A",                fg: "#B45309", activeFg: "#292200" },
  WORK_DONE_PENDING_CONFIRMATION: { vivid: "#7C3AED", softBg: "rgba(124,58,237,0.10)",  bg: "#EDE9FE",                fg: "#6D28D9", activeFg: "#fff" },
  REVIEW_REQUIRED:                { vivid: "#EA580C", softBg: "rgba(234,88,12,0.10)",   bg: "#FFEDD5",                fg: "#C2410C", activeFg: "#fff" },
  COMPLETED:                      { vivid: "#10B981", softBg: "rgba(16,185,129,0.10)",  bg: "rgba(16,185,129,0.10)",  fg: "#065F46", activeFg: "#fff" },
  CANCELLED:                      { vivid: "#EF4444", softBg: "rgba(239,68,68,0.12)",   bg: "rgba(239,68,68,0.12)",   fg: "#B91C1C", activeFg: "#fff" },
  UNKNOWN:                        { vivid: "#6B7280", softBg: "rgba(107,114,128,0.10)", bg: "rgba(107,114,128,0.10)", fg: "#4B5563", activeFg: "#fff" },
}

// Dark-mode vivid colors are all high-luminance (bright) — every one fails WCAG with white text,
// so active chips universally use near-black text on the vivid background.
const DARK: ColorMap = {
  OPEN:                           { vivid: "#38BDF8", softBg: "rgba(56,189,248,0.15)",   bg: "#0C4A6E", fg: "#7DD3FC", activeFg: "#000" },
  PENDING:                        { vivid: "#38BDF8", softBg: "rgba(56,189,248,0.15)",   bg: "#0C4A6E", fg: "#7DD3FC", activeFg: "#000" },
  PENDING_AUTH:                   { vivid: "#60A5FA", softBg: "rgba(96,165,250,0.15)",   bg: "#1E3A5F", fg: "#93C5FD", activeFg: "#000" },
  ASSIGNED:                       { vivid: "#FCD34D", softBg: "rgba(252,211,77,0.15)",   bg: "#78350F", fg: "#FDE68A", activeFg: "#1C1200" },
  WORK_DONE_PENDING_CONFIRMATION: { vivid: "#A78BFA", softBg: "rgba(167,139,250,0.15)",  bg: "#3B0764", fg: "#C4B5FD", activeFg: "#000" },
  REVIEW_REQUIRED:                { vivid: "#FB923C", softBg: "rgba(251,146,60,0.15)",   bg: "#431407", fg: "#FCA572", activeFg: "#000" },
  COMPLETED:                      { vivid: "#34D399", softBg: "rgba(52,211,153,0.15)",   bg: "#14532D", fg: "#6EE7B7", activeFg: "#00251A" },
  CANCELLED:                      { vivid: "#F87171", softBg: "rgba(248,113,113,0.15)",  bg: "#450A0A", fg: "#FCA5A5", activeFg: "#000" },
  UNKNOWN:                        { vivid: "#9CA3AF", softBg: "rgba(156,163,175,0.15)",  bg: "#1F2937", fg: "#D1D5DB", activeFg: "#000" },
}

export function getStatusColors(status: TaskStatus | string, isDark: boolean): StatusColorSet {
  const map = isDark ? DARK : LIGHT
  return map[status] ?? (isDark ? DARK.UNKNOWN : LIGHT.UNKNOWN)
}
