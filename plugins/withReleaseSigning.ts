import { ConfigPlugin, withAppBuildGradle } from "expo/config-plugins"

// Anchors below match the current checked-in android/app/build.gradle and the
// default RN/Expo bare template's debug signingConfig + release buildType boilerplate.
// Must be re-verified against the SDK 54 dry-run prebuild output before the real prebuild —
// if Expo's template wording shifted, this plugin throws rather than silently no-opping.

const RELEASE_SIGNING_HELPER = `def releaseSigningValue = { name ->
    findProperty(name) ?: System.getenv(name)
}

`

const DEBUG_SIGNING_CONFIG = `debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }`

const RELEASE_SIGNING_CONFIG = `
        release {
            def releaseStoreFile = releaseSigningValue('OOLSHIK_RELEASE_STORE_FILE')
            def releaseStorePassword = releaseSigningValue('OOLSHIK_RELEASE_STORE_PASSWORD')
            def releaseKeyAlias = releaseSigningValue('OOLSHIK_RELEASE_KEY_ALIAS')
            def releaseKeyPassword = releaseSigningValue('OOLSHIK_RELEASE_KEY_PASSWORD')
            if (releaseStoreFile && releaseStorePassword && releaseKeyAlias && releaseKeyPassword) {
                storeFile file(releaseStoreFile)
                storePassword releaseStorePassword
                keyAlias releaseKeyAlias
                keyPassword releaseKeyPassword
            }
        }`

const RELEASE_BUILD_TYPE_DEFAULT_SIGNING =
  "// Caution! In production, you need to generate your own keystore file.\n            // see https://reactnative.dev/docs/signed-apk-android.\n            signingConfig signingConfigs.debug"

const RELEASE_BUILD_TYPE_CUSTOM_SIGNING =
  "if (signingConfigs.release.storeFile != null) {\n                signingConfig signingConfigs.release\n            }"

export const withReleaseSigning: ConfigPlugin = (config) =>
  withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== "groovy") {
      throw new Error("withReleaseSigning expects a Groovy android/app/build.gradle file.")
    }

    let contents = modConfig.modResults.contents

    if (!contents.includes("def releaseSigningValue")) {
      contents = RELEASE_SIGNING_HELPER + contents
    }

    if (!contents.includes("OOLSHIK_RELEASE_STORE_FILE")) {
      if (!contents.includes(DEBUG_SIGNING_CONFIG)) {
        throw new Error(
          "withReleaseSigning: expected default `signingConfigs { debug { ... } }` block not found in build.gradle — Expo's template may have changed, update this plugin's anchors.",
        )
      }
      contents = contents.replace(
        DEBUG_SIGNING_CONFIG,
        DEBUG_SIGNING_CONFIG + RELEASE_SIGNING_CONFIG,
      )
    }

    if (!contents.includes(RELEASE_BUILD_TYPE_CUSTOM_SIGNING)) {
      if (!contents.includes(RELEASE_BUILD_TYPE_DEFAULT_SIGNING)) {
        throw new Error(
          "withReleaseSigning: expected default release buildType signing anchor not found in build.gradle — Expo's template may have changed, update this plugin's anchors.",
        )
      }
      contents = contents.replace(
        RELEASE_BUILD_TYPE_DEFAULT_SIGNING,
        RELEASE_BUILD_TYPE_CUSTOM_SIGNING,
      )
    }

    modConfig.modResults.contents = contents
    return modConfig
  })
