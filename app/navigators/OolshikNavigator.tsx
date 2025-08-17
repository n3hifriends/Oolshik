import React from "react"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import OnboardingConsentScreen from "@/screens/OnboardingConsentScreen"
import HomeFeedScreen from "@/screens/HomeFeedScreen"
import CreateTaskScreen from "@/screens/CreateTaskScreen"
import TaskDetailScreen from "@/screens/TaskDetailScreen"
import MyTasksScreen from "@/screens/MyTasksScreen"
import ChatScreen from "@/screens/ChatScreen"
import ProfileScreen from "@/screens/ProfileScreen"
import ReportScreen from "@/screens/ReportScreen"

export type OolshikParamList = {
  OolshikOnboard: undefined
  OolshikHome: undefined
  OolshikCreate: undefined
  OolshikDetail: { id: string }
  OolshikMy: undefined
  OolshikChat: { taskId: string }
  OolshikProfile: undefined
  OolshikReport: { taskId?: string; targetUserId?: string }
}

const Stack = createNativeStackNavigator<OolshikParamList>()

export function OolshikNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, animation: "slide_from_right" }}
      initialRouteName="OolshikOnboard"
    >
      <Stack.Screen name="OolshikOnboard" component={OnboardingConsentScreen} />
      <Stack.Screen name="OolshikHome" component={HomeFeedScreen} />
      <Stack.Screen name="OolshikCreate" component={CreateTaskScreen} />
      <Stack.Screen name="OolshikDetail" component={TaskDetailScreen} />
      <Stack.Screen name="OolshikMy" component={MyTasksScreen} />
      <Stack.Screen name="OolshikChat" component={ChatScreen} />
      <Stack.Screen name="OolshikProfile" component={ProfileScreen} />
      <Stack.Screen name="OolshikReport" component={ReportScreen} />
    </Stack.Navigator>
  )
}
