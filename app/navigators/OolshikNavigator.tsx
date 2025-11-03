import React, { useEffect, useState } from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import type { NativeStackScreenProps } from "@react-navigation/native-stack"
import OnboardingConsentScreen from "@/screens/OnboardingConsentScreen"
import HomeFeedScreen from "@/screens/HomeFeedScreen"
import CreateTaskScreen from "@/screens/CreateTaskScreen"
import TaskDetailScreen from "@/screens/TaskDetailScreen"
import MyTasksScreen from "@/screens/MyTasksScreen"
import ChatScreen from "@/screens/ChatScreen"
import ProfileScreen from "@/screens/ProfileScreen"
import ReportScreen from "@/screens/ReportScreen"
import { useMMKVString } from "react-native-mmkv"
import { storage } from "@/utils/storage"
import { QrScannerScreen } from "@/screens/QrScannerScreen"
import { PaymentPayScreen } from "@/screens/PaymentPayScreen"

/**
 * IMPORTANT
 * We decide the initial route at runtime so that:
 * - Onboarding is shown ONLY the first time after login OR when we detect it hasn't been completed.
 * - Otherwise, users go straight to Home.
 *
 * We persist a single boolean flag after a successful onboarding flow:
 *   key: "onboarding.v1.completed" -> "true" | undefined
 *
 * If your OnboardingConsentScreen already handles permissions, call:
 *   await AsyncStorage.setItem("onboarding.v1.completed", "true")
 * when the user finishes granting or explicitly skipping with your app's policy.
 */

export type OolshikParamList = {
  OolshikOnboard: undefined
  OolshikHome: undefined
  OolshikCreate: undefined
  OolshikDetail: { id: string }
  OolshikMy: undefined
  OolshikChat: { taskId: string }
  OolshikProfile: undefined
  OolshikReport: { taskId?: string; targetUserId?: string }
  QrScanner: { taskId: string }
  PaymentPay: { taskId: string }
}

export type OolshikStackScreenProps<T extends keyof OolshikParamList> = NativeStackScreenProps<
  OolshikParamList,
  T
>

const Stack = createNativeStackNavigator<OolshikParamList>()

export function OolshikNavigator() {
  const [initialRoute, setInitialRoute] = useState<keyof OolshikParamList | null>(null)
  const [onboardingComplete, setOnboardingComplete] = useMMKVString(
    "onboarding.v1.completed",
    storage,
  )

  useEffect(() => {
    const decide = async () => {
      try {
        // If flag not set, show onboarding; else jump to Home
        setInitialRoute(onboardingComplete === "true" ? "OolshikHome" : "OolshikOnboard")
      } catch {
        // Fail-safe: if anything goes wrong, keep user functional and go to Home
        setInitialRoute("OolshikHome")
      }
    }
    decide()
  }, [])

  // Avoid rendering the navigator until we know the initial route
  if (!initialRoute) return null

  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: "slide_from_right" }}
      initialRouteName={initialRoute}
    >
      <Stack.Screen name="OolshikOnboard" component={OnboardingConsentScreen} />
      <Stack.Screen name="OolshikHome" component={HomeFeedScreen} />
      <Stack.Screen name="OolshikCreate" component={CreateTaskScreen} />
      <Stack.Screen name="OolshikDetail" component={TaskDetailScreen} />
      <Stack.Screen name="OolshikMy" component={MyTasksScreen} />
      <Stack.Screen name="OolshikChat" component={ChatScreen} />
      <Stack.Screen name="OolshikProfile" component={ProfileScreen} />
      <Stack.Screen name="OolshikReport" component={ReportScreen} />
      <Stack.Screen name="QrScanner" component={QrScannerScreen} />
      <Stack.Screen name="PaymentPay" component={PaymentPayScreen} />
    </Stack.Navigator>
  )
}
