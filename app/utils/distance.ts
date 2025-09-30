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

export const distanceLabel = (m?: number) => {
  if (m == null || Number.isNaN(m)) return ""
  if (m < 1000) return `${Math.round(m)} m`
  const km = m / 1000
  return `${km.toFixed(km < 10 ? 1 : 0)} km`
}
