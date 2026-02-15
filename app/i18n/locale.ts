import * as Localization from "expo-localization"

export type SupportedLocaleTag = "en-IN" | "mr-IN"

export const FALLBACK_LOCALE: SupportedLocaleTag = "en-IN"
export const SUPPORTED_LOCALES: readonly SupportedLocaleTag[] = ["en-IN", "mr-IN"]

function isSupportedInput(input?: string | null): boolean {
  if (!input) return false
  const normalized = input.trim().replace(/_/g, "-").toLowerCase()
  return normalized.startsWith("en") || normalized.startsWith("mr")
}

export function normalizeLocaleTag(input?: string | null): SupportedLocaleTag {
  if (!input) return FALLBACK_LOCALE
  const normalized = input.trim().replace(/_/g, "-").toLowerCase()
  if (normalized.startsWith("mr")) return "mr-IN"
  return "en-IN"
}

export function toLanguageCode(input?: string | null): "en" | "mr" {
  return normalizeLocaleTag(input) === "mr-IN" ? "mr" : "en"
}

export function fromLanguageCode(input?: string | null): SupportedLocaleTag {
  return input === "mr" ? "mr-IN" : "en-IN"
}

export function pickDeviceLocaleTag(
  locales: Localization.Locale[] = Localization.getLocales(),
): SupportedLocaleTag | undefined {
  const firstSupported = locales.find((locale) => {
    const raw = (locale.languageTag || "").toLowerCase()
    return raw.startsWith("en") || raw.startsWith("mr")
  })
  return firstSupported ? normalizeLocaleTag(firstSupported.languageTag) : undefined
}

export function resolvePreferredLocale(options: {
  serverPreference?: string | null
  localPreference?: string | null
  deviceLocaleTag?: string | null
}): SupportedLocaleTag {
  if (isSupportedInput(options.serverPreference)) return normalizeLocaleTag(options.serverPreference)
  if (isSupportedInput(options.localPreference)) return normalizeLocaleTag(options.localPreference)
  if (isSupportedInput(options.deviceLocaleTag)) return normalizeLocaleTag(options.deviceLocaleTag)
  return FALLBACK_LOCALE
}
