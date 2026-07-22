import { Linking, Platform } from "react-native"

export type MapProviderId = "googleMaps" | "appleMaps" | "waze" | "mappls"

export type MapProviderOption = {
  id: MapProviderId
  label: string
}

type MapProviderDef = {
  id: MapProviderId
  label: string
  platforms: Array<"ios" | "android">
  // Scheme probed via Linking.canOpenURL to decide if the app is installed.
  // null means "always considered available" (e.g. an https universal link).
  probeScheme: string | null
  buildAppUrl: (lat: number, lon: number, label: string) => string
  buildWebUrl: (lat: number, lon: number, label: string) => string
}

const MAP_PROVIDERS: MapProviderDef[] = [
  {
    id: "googleMaps",
    label: "Google Maps",
    platforms: ["ios", "android"],
    // `geo:` is a public scheme other installed apps can also claim, which
    // triggers Android's own disambiguation sheet instead of opening Maps.
    probeScheme: Platform.OS === "ios" ? "comgooglemaps://" : null,
    buildAppUrl: (lat, lon, _label) =>
      Platform.OS === "ios"
        ? `comgooglemaps://?q=${lat},${lon}&center=${lat},${lon}`
        : `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
    buildWebUrl: (lat, lon) => `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`,
  },
  {
    id: "appleMaps",
    label: "Apple Maps",
    platforms: ["ios"],
    probeScheme: null,
    buildAppUrl: (lat, lon, label) =>
      `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent(label)}`,
    buildWebUrl: (lat, lon, label) =>
      `https://maps.apple.com/?ll=${lat},${lon}&q=${encodeURIComponent(label)}`,
  },
  {
    id: "waze",
    label: "Waze",
    platforms: ["ios", "android"],
    probeScheme: "waze://",
    buildAppUrl: (lat, lon) => `waze://?ll=${lat},${lon}`,
    buildWebUrl: (lat, lon) => `https://waze.com/ul?ll=${lat},${lon}`,
  },
  {
    id: "mappls",
    label: "Mappls",
    platforms: ["ios", "android"],
    probeScheme: "mappls://",
    buildAppUrl: (lat, lon) => `mappls://?ll=${lat},${lon}`,
    buildWebUrl: (lat, lon) => `https://mappls.com/@${lat},${lon}`,
  },
]

async function isProviderAvailable(def: MapProviderDef): Promise<boolean> {
  if (!def.platforms.includes(Platform.OS as "ios" | "android")) return false
  if (!def.probeScheme) return true
  try {
    return await Linking.canOpenURL(def.probeScheme)
  } catch {
    return false
  }
}

/**
 * Returns only the navigation apps actually installed on the device (plus
 * Apple Maps on iOS, which is always present). Requires the probe schemes to
 * be declared in LSApplicationQueriesSchemes (iOS) / <queries> (Android),
 * otherwise canOpenURL always resolves false.
 */
export async function getAvailableMapProviders(): Promise<MapProviderOption[]> {
  const results = await Promise.all(
    MAP_PROVIDERS.map(async (def) => ((await isProviderAvailable(def)) ? def : null)),
  )
  return results
    .filter((def): def is MapProviderDef => def != null)
    .map((def) => ({ id: def.id, label: def.label }))
}

/**
 * Launches the given provider's app; if that fails (not installed, rejected,
 * etc.) falls back to the provider's web URL. Throws only if both fail.
 */
export async function launchMapProvider(
  id: MapProviderId,
  lat: number,
  lon: number,
  label: string,
): Promise<void> {
  const def = MAP_PROVIDERS.find((provider) => provider.id === id)
  if (!def) throw new Error(`Unknown map provider: ${id}`)

  try {
    await Linking.openURL(def.buildAppUrl(lat, lon, label))
    return
  } catch {
    // fall through to web fallback
  }

  await Linking.openURL(def.buildWebUrl(lat, lon, label))
}
