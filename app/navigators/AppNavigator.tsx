/**
 * The app navigator (formerly "AppNavigator" and "MainNavigator") is used for the primary
 * navigation flows of your app.
 * Generally speaking, it will contain an auth flow (registration, login, forgot password)
 * and a "main" flow which the user will use once logged in.
 */
import { ComponentProps } from "react"
import { Platform } from "react-native"
import * as Application from "expo-application"
import * as SplashScreen from "expo-splash-screen"
import {
  NavigationContainer,
  NavigatorScreenParams, // @demo remove-current-line
} from "@react-navigation/native"
import { createNativeStackNavigator, NativeStackScreenProps } from "@react-navigation/native-stack"

import Config from "@/config"
import { useAuth } from "@/context/AuthContext" // @demo remove-current-line
import { OolshikNavigator } from "@/navigators/OolshikNavigator"
import { ErrorBoundary } from "@/screens/ErrorScreen/ErrorBoundary"
import { ForceUpdateScreen } from "@/screens/ForceUpdateScreen"
import { HelpRequestsUnavailableScreen } from "@/screens/HelpRequestsUnavailableScreen"
import { LoginScreen } from "@/screens/LoginScreen" // @demo remove-current-line
import { MaintenanceScreen } from "@/screens/MaintenanceScreen"
import { useRemoteConfig, getMaintenanceConfig, getVersionConfig } from "@/services/remoteConfig"
import { useAppTheme } from "@/theme/context"

import { DemoNavigator, DemoTabParamList } from "./DemoNavigator" // @demo remove-current-line
import { navigationRef, useBackButtonHandler } from "./navigationUtilities"
/**
 * This type allows TypeScript to know what routes are defined in this navigator
 * as well as what properties (if any) they might take when navigating to them.
 *
 * For more information, see this documentation:
 *   https://reactnavigation.org/docs/params/
 *   https://reactnavigation.org/docs/typescript#type-checking-the-navigator
 *   https://reactnavigation.org/docs/typescript/#organizing-types
 */
export type AppStackParamList = {
  Login: undefined // @demo remove-current-line
  Demo: NavigatorScreenParams<DemoTabParamList> // @demo remove-current-line
  // 🔥 Your screens go here
  QrScanner: undefined
  PaymentPay: undefined
  // IGNITE_GENERATOR_ANCHOR_APP_STACK_PARAM_LIST
  Oolshik: undefined
  Maintenance: undefined
  ForceUpdate: undefined
  HelpRequestsUnavailable: undefined
}

/**
 * This is a list of all the route names that will exit the app if the back button
 * is pressed while in that screen. Only affects Android.
 */
const exitRoutes = Config.exitRoutes

export type AppStackScreenProps<T extends keyof AppStackParamList> = NativeStackScreenProps<
  AppStackParamList,
  T
>

// Compares semver strings; returns true if `current` is below `minimum`.
function isBelowMinVersion(current: string, minimum: string): boolean {
  if (!minimum || minimum === "0.0.0") return false
  const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0)
  const [cMaj, cMin, cPatch] = parse(current)
  const [mMaj, mMin, mPatch] = parse(minimum)
  if (cMaj !== mMaj) return cMaj < mMaj
  if (cMin !== mMin) return cMin < mMin
  return cPatch < mPatch
}

// Documentation: https://reactnavigation.org/docs/stack-navigator/
const Stack = createNativeStackNavigator<AppStackParamList>()

const AppStack = () => {
  // @demo remove-block-start
  const { isAuthenticated } = useAuth()
  // @demo remove-block-end
  const {
    theme: { colors },
  } = useAppTheme()

  const flags = useRemoteConfig()

  // ---------------------------------------------------------------------------
  // App-gate precedence (each gate fully replaces the stack — no header/back):
  //   1. Maintenance     — whole app, all users, authenticated or not
  //   2. Force update    — whole app, below-minimum installed versions
  //   3. Help unavailable — authenticated users only, single-feature gate
  // Checked in this order every render; do not reorder without updating the
  // corresponding screen copy, which assumes this precedence (e.g. the
  // maintenance screen doesn't mention login state because it can't be reached
  // without maintenance being off).
  // ---------------------------------------------------------------------------

  // --- Maintenance gate (highest priority — applies to all users) ---
  const maintenance = getMaintenanceConfig()
  if (maintenance.enabled) {
    return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          navigationBarColor: colors.background,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Maintenance" component={MaintenanceScreen} />
      </Stack.Navigator>
    )
  }

  // --- Force update / version gate ---
  const version = getVersionConfig()
  const currentVersion = Application.nativeApplicationVersion ?? "0.0.0"
  const minVersion = Platform.OS === "android" ? version.minAndroid : version.minIos
  const needsUpdate = version.forceUpdateEnabled && isBelowMinVersion(currentVersion, minVersion)
  if (needsUpdate) {
    return (
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          navigationBarColor: colors.background,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="ForceUpdate" component={ForceUpdateScreen} />
      </Stack.Navigator>
    )
  }

  const helpRequestsEnabled = flags.feature_help_requests_enabled

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        navigationBarColor: colors.background,
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      {/* @demo remove-block-start */}
      {isAuthenticated ? (
        <>
          {helpRequestsEnabled ? (
            <Stack.Screen
              name="Oolshik"
              component={OolshikNavigator}
              options={{ headerShown: false }}
            />
          ) : (
            <Stack.Screen
              name="HelpRequestsUnavailable"
              component={HelpRequestsUnavailableScreen}
            />
          )}
          {/* @demo remove-block-end */}
          {/* @demo remove-block-start */}
          {/* <Stack.Screen name="Demo" component={DemoNavigator} /> */}
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      )}
      {/* @demo remove-block-end */}
      {/** 🔥 Your screens go here */}
      {/* IGNITE_GENERATOR_ANCHOR_APP_STACK_SCREENS */}
    </Stack.Navigator>
  )
}

export interface NavigationProps extends Partial<
  ComponentProps<typeof NavigationContainer<AppStackParamList>>
> {}

export const AppNavigator = (props: NavigationProps) => {
  const { navigationTheme } = useAppTheme()

  useBackButtonHandler((routeName) => exitRoutes.includes(routeName))

  const handleReady = () => {
    // Hide the native splash after the NavigationContainer has committed its
    // first layout — the earliest point where the app is visually ready.
    // Any onReady prop from a parent (e.g. tests) is also forwarded.
    SplashScreen.hideAsync()
    props.onReady?.()
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      {...props}
      onReady={handleReady}
    >
      <ErrorBoundary catchErrors={Config.catchErrors}>
        <AppStack />
      </ErrorBoundary>
    </NavigationContainer>
  )
}
