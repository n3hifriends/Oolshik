import { ExpoConfig, ConfigContext } from "@expo/config"

/**
 * Use ts-node here so we can use TypeScript for our Config Plugins
 * and not have to compile them to JavaScript
 */
require("ts-node/register")

/**
 * @param config ExpoConfig coming from the static config app.json if it exists
 *
 * You can read more about Expo's Configuration Resolution Rules here:
 * https://docs.expo.dev/workflow/configuration/#configuration-resolution-rules
 */
module.exports = ({ config }: ConfigContext): Partial<ExpoConfig> => {
  const existingPlugins = config.plugins ?? []

  return {
    ...config,
    extra: {
      ...(config.extra ?? {}),
      eas: {
        ...(config.extra?.eas ?? {}),
        projectId: "86345f55-b151-453a-aa0e-5357b9aaddf7",
      },
    },
    ios: {
      ...config.ios,
      // This privacyManifests is to get you started.
      // See Expo's guide on apple privacy manifests here:
      // https://docs.expo.dev/guides/apple-privacy/
      // You may need to add more privacy manifests depending on your app's usage of APIs.
      // More details and a list of "required reason" APIs can be found in the Apple Developer Documentation.
      // https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
      privacyManifests: {
        NSPrivacyAccessedAPITypes: [
          {
            NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults",
            NSPrivacyAccessedAPITypeReasons: ["CA92.1"], // CA92.1 = "Access info from same app, per documentation"
          },
        ],
      },
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        // Needed to check for installed maps apps for turn-by-turn navigation deep links.
        LSApplicationQueriesSchemes: ["comgooglemaps", "waze", "mappls"],
      },
    },
    plugins: [
      ...existingPlugins,
      require("./plugins/withAndroidPhoneNumberHint").withAndroidPhoneNumberHint,
      require("./plugins/withUpiLauncher").withUpiLauncher,
      require("./plugins/withAndroidQueries").withAndroidQueries,
      require("./plugins/withReleaseSigning").withReleaseSigning,
      require("./plugins/withFirebaseMessagingManifestFix").withFirebaseMessagingManifestFix,
      "expo-web-browser",
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      "@react-native-firebase/crashlytics",
      [
        "expo-build-properties",
        {
          ios: {
            // React Native Firebase requires static framework linkage on iOS.
            useFrameworks: "static",
          },
        },
      ],
    ],
  }
}
