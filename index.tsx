import "@expo/metro-runtime" // this is for fast refresh on web w/o expo-router
import { registerRootComponent } from "expo"

import { App } from "@/app"
import { initRemoteConfig } from "@/services/remoteConfig"

// Kick off Remote Config fetch before the root component mounts.
// Defaults are set synchronously inside initRemoteConfig, so the app is fully
// functional even if the network call never completes.
initRemoteConfig()

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App)
