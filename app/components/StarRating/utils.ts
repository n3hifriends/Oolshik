export type RatingDescriptorKey = "poor" | "okay" | "good" | "excellent"

type NormalizeRatingOptions = {
  min?: number
  max?: number
  step?: number
}

export function clampRating(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

export function normalizeRating(value: number, options: NormalizeRatingOptions = {}) {
  const min = options.min ?? 0
  const max = options.max ?? 5
  const step = options.step ?? 0.5

  const safeStep = step > 0 ? step : 0.5
  const clamped = clampRating(value, min, max)
  const snapped = Math.round(clamped / safeStep) * safeStep

  // Keep one decimal precision for API payload compatibility (numeric(2,1)).
  return Number(clampRating(snapped, min, max).toFixed(1))
}

export function getRatingDescriptorKey(value: number): RatingDescriptorKey {
  if (value <= 1.5) return "poor"
  if (value <= 3.0) return "okay"
  if (value <= 4.0) return "good"
  return "excellent"
}
