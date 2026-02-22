export type DistanceTranslateFn = (key: string, options?: Record<string, unknown>) => string

export const formatDistanceLabel = (
  m: number | undefined,
  t: DistanceTranslateFn,
): string | null => {
  if (m == null || !Number.isFinite(m) || m < 0) return null
  if (m < 1000) return `${Math.round(m)}${t("oolshik:units.mShort")}`
  const km = m / 1000
  return `${km.toFixed(km < 10 ? 1 : 0)}${t("oolshik:units.kmShort")}`
}

export const getDistanceMeters = (t: any): number | undefined => {
  const candidates = [
    t?.distanceMtr,
    t?.distance_m,
    t?.distanceMeters,
    t?.distance,
    typeof t?.distanceKm === "number" ? t.distanceKm * 1000 : undefined,
  ]
  const first = candidates.find((x) => typeof x === "number" && Number.isFinite(x))
  return typeof first === "number" ? first : undefined
}

const EN_DISTANCE_TRANSLATOR: DistanceTranslateFn = (key) =>
  key.endsWith("mShort") ? " m" : " km"

export const distanceLabel = (m?: number, t: DistanceTranslateFn = EN_DISTANCE_TRANSLATOR) => {
  return formatDistanceLabel(m, t)?.trimStart() ?? ""
}

export const distanceSearchLabels = (m: number | undefined, t?: DistanceTranslateFn): string[] => {
  if (m == null || !Number.isFinite(m) || m < 0) return []

  const english = distanceLabel(m)
  const localized = t ? distanceLabel(m, t) : ""
  const km = m / 1000
  const kmOneDecimal = km.toFixed(1)

  const localizedNoDots = localized.replace(/\./g, "")
  const localizedSpaced = localized.replace(/(\d)(\D)/, "$1 $2")
  const localizedNoDotsSpaced = localizedNoDots.replace(/(\d)(\D)/, "$1 $2")

  return [
    english,
    localized,
    localizedSpaced,
    localizedNoDots,
    localizedNoDotsSpaced,
    String(Math.round(m)),
    `${kmOneDecimal} km`,
    `${kmOneDecimal}km`,
  ].filter(Boolean)
}
