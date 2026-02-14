export type ParsedUpiQr = {
  format: "upi-uri" | "unknown"
  raw: string
  payeeVpa: string | null
  payeeName: string | null
  txnRef: string | null
  merchantId: string | null
  mcc: string | null
  amount: number | null
  currency: string | null
  note: string | null
}

function decodeParam(value: string) {
  if (!value) return ""
  const withSpaces = value.includes("+") ? value.replace(/\+/g, " ") : value
  try {
    return decodeURIComponent(withSpaces)
  } catch {
    return withSpaces
  }
}

function parseQuery(query: string) {
  const out: Record<string, string> = Object.create(null)
  let start = 0
  for (let i = 0; i <= query.length; i++) {
    if (i === query.length || query.charCodeAt(i) === 38) {
      if (i > start) {
        const segment = query.slice(start, i)
        const idx = segment.indexOf("=")
        const rawKey = idx === -1 ? segment : segment.slice(0, idx)
        const rawValue = idx === -1 ? "" : segment.slice(idx + 1)
        const key = decodeParam(rawKey).trim()
        if (key.length > 0) {
          out[key] = decodeParam(rawValue)
        }
      }
      start = i + 1
    }
  }
  return out
}

function toNumber(value?: string | null) {
  if (!value) return null
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

function clean(value?: string | null) {
  if (!value) return null
  const v = value.trim()
  return v.length > 0 ? v : null
}

export function parseUpiQr(raw: string): ParsedUpiQr {
  if (!raw || !raw.startsWith("upi://")) {
    return {
      format: "unknown",
      raw,
      payeeVpa: null,
      payeeName: null,
      txnRef: null,
      merchantId: null,
      mcc: null,
      amount: null,
      currency: null,
      note: null,
    }
  }

  const qIndex = raw.indexOf("?")
  if (qIndex < 0 || qIndex === raw.length - 1) {
    return {
      format: "unknown",
      raw,
      payeeVpa: null,
      payeeName: null,
      txnRef: null,
      merchantId: null,
      mcc: null,
      amount: null,
      currency: null,
      note: null,
    }
  }

  const params = parseQuery(raw.slice(qIndex + 1))

  return {
    format: "upi-uri",
    raw,
    payeeVpa: clean(params.pa),
    payeeName: clean(params.pn),
    txnRef: clean(params.tr || params.txnRef),
    merchantId: clean(params.mid),
    mcc: clean(params.mc),
    amount: toNumber(clean(params.am)),
    currency: clean(params.cu) || "INR",
    note: clean(params.tn),
  }
}
