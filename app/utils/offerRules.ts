export type OfferParseResult = {
  ok: boolean
  amount: number | null
  error?: string
}

export function parseOfferInput(value: string): OfferParseResult {
  const trimmed = (value || "").trim()
  if (!trimmed) {
    return { ok: true, amount: null }
  }
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n < 0 || n > 1000000) {
    return { ok: false, amount: null, error: "Enter a valid offer between 0 and 1000000." }
  }
  return { ok: true, amount: Number(n.toFixed(2)) }
}

export function canEditOfferForTask(
  isRequester: boolean,
  status?: string | null,
  helperId?: string | null,
) {
  return isRequester && status === "OPEN" && !helperId
}
