const INDIA_COUNTRY_CODE = "91"
const INDIA_NATIONAL_NUMBER_LENGTH = 10
const INDIA_MOBILE_NUMBER_PATTERN = /^\d{10}$/

export interface NormalizedIndianPhoneNumber {
  nationalNumber: string | null
  e164: string | null
}

export function getDigitsOnly(raw: string) {
  return raw.replace(/\D/g, "")
}

export function toIndianNationalNumber(raw: string) {
  const digits = getDigitsOnly(raw.trim())
  const digitsWithoutInternationalPrefix = digits.replace(/^00/, "")

  function extractAfterPrefix(value: string, prefix: string) {
    if (!value.startsWith(prefix)) return ""
    const nationalNumber = value.slice(prefix.length, prefix.length + INDIA_NATIONAL_NUMBER_LENGTH)
    return nationalNumber.length === INDIA_NATIONAL_NUMBER_LENGTH ? nationalNumber : ""
  }

  if (digits.length === INDIA_NATIONAL_NUMBER_LENGTH) return digits
  if (digits.length === INDIA_NATIONAL_NUMBER_LENGTH + 1 && digits.startsWith("0")) {
    return digits.slice(1)
  }

  const prefixedCandidates = [
    extractAfterPrefix(digits, `0${INDIA_COUNTRY_CODE}`),
    extractAfterPrefix(digits, INDIA_COUNTRY_CODE),
    extractAfterPrefix(digitsWithoutInternationalPrefix, INDIA_COUNTRY_CODE),
  ]

  const prefixedMatch = prefixedCandidates.find(
    (candidate) => candidate.length === INDIA_NATIONAL_NUMBER_LENGTH,
  )
  if (prefixedMatch) return prefixedMatch

  const embeddedPrefixMatch =
    digits.match(/(?:0091|091|91)(\d{10})/) ??
    digitsWithoutInternationalPrefix.match(/91(\d{10})/)
  if (embeddedPrefixMatch?.[1]?.length === INDIA_NATIONAL_NUMBER_LENGTH) {
    return embeddedPrefixMatch[1]
  }

  return ""
}

export function isLikelyIndianMobileNumber(nationalNumber: string) {
  return INDIA_MOBILE_NUMBER_PATTERN.test(nationalNumber)
}

export function normalizeIndianPhoneNumber(raw: string): NormalizedIndianPhoneNumber {
  const nationalNumber = toIndianNationalNumber(raw)
  if (!isLikelyIndianMobileNumber(nationalNumber)) {
    return { nationalNumber: null, e164: null }
  }

  return {
    nationalNumber,
    e164: `+${INDIA_COUNTRY_CODE}${nationalNumber}`,
  }
}

export function toIndianE164(raw: string) {
  return normalizeIndianPhoneNumber(raw).e164 ?? ""
}
