import { ConfigPlugin, withFinalizedMod } from "expo/config-plugins"

const fs = require("fs").promises
const path = require("path")

const META_DATA_TAG =
  '<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="default"/>'
const META_DATA_TAG_FIXED =
  '<meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="default" tools:replace="android:value"/>'

// @react-native-firebase/messaging's own AndroidManifest.xml declares this same
// meta-data key, which conflicts with the one expo-notifications generates from
// app.json's `defaultChannel` option. Newer AGP's manifest merger (bundled with
// SDK 54) rejects the duplicate unless explicitly told which value wins.
//
// expo-notifications injects this meta-data via its own built-in plugin, which
// Expo's prebuild-config appends to config.plugins AFTER app.config.ts's plugins
// array is resolved — so it always runs after ours, regardless of array position.
// withFinalizedMod is the only mod type guaranteed to run after that (dangerous
// mods run first, finalized mods run last), so it's required here — a normal
// withAndroidManifest/withDangerousMod runs too early to see this meta-data.
export const withFirebaseMessagingManifestFix: ConfigPlugin = (config) =>
  withFinalizedMod(config, [
    "android",
    async (modConfig) => {
      const manifestPath = path.join(
        modConfig.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "AndroidManifest.xml",
      )
      const contents = await fs.readFile(manifestPath, "utf8")

      if (!contents.includes(META_DATA_TAG_FIXED)) {
        if (!contents.includes(META_DATA_TAG)) {
          throw new Error(
            "withFirebaseMessagingManifestFix: expected default_notification_channel_id meta-data tag not found in AndroidManifest.xml — expo-notifications' generated output may have changed, update this plugin's anchor.",
          )
        }
        await fs.writeFile(
          manifestPath,
          contents.replace(META_DATA_TAG, META_DATA_TAG_FIXED),
          "utf8",
        )
      }

      return modConfig
    },
  ])
