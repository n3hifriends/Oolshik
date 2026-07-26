import { ConfigPlugin, withAndroidManifest } from "expo/config-plugins"

const INTENT_SCHEMES = ["https", "upi", "mailto"] as const

const QUERY_PACKAGES = [
  "com.google.android.apps.maps",
  "com.waze",
  "com.mmi.maps",
  "com.phonepe.app",
  "com.google.android.apps.nbu.paisa.user",
  "net.one97.paytm",
  "in.org.npci.upiapp",
  "in.amazon.mShop.android.shopping",
] as const

export const withAndroidQueries: ConfigPlugin = (config) =>
  withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults.manifest
    manifest.queries = manifest.queries ?? []

    let queries = manifest.queries[0]
    if (!queries) {
      queries = {}
      manifest.queries.push(queries)
    }

    queries.package = queries.package ?? []
    const existingPackages = new Set(queries.package.map((entry) => entry.$["android:name"]))
    for (const name of QUERY_PACKAGES) {
      if (!existingPackages.has(name)) {
        queries.package.push({ $: { "android:name": name } })
      }
    }

    queries.intent = queries.intent ?? []
    const existingSchemes = new Set(
      queries.intent.map((entry) => entry.data?.[0]?.$["android:scheme"]),
    )
    for (const scheme of INTENT_SCHEMES) {
      if (existingSchemes.has(scheme)) continue
      queries.intent.push({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        ...(scheme === "https"
          ? { category: [{ $: { "android:name": "android.intent.category.BROWSABLE" } }] }
          : {}),
        data: [{ $: { "android:scheme": scheme } }],
      })
    }

    return modConfig
  })
