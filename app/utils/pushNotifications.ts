import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { OolshikApi } from "@/api/client"
import { navigate } from "@/navigators/navigationUtilities"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

export async function getExpoPushTokenAsync(): Promise<string | null> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== "granted") return null

  const token = (await Notifications.getExpoPushTokenAsync()).data
  return token
}

export async function registerDeviceToken(token: string) {
  await OolshikApi.registerDevice(token, Platform.OS)
}

export async function registerDeviceTokenWithRetry(token: string, maxAttempts = 2) {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await registerDeviceToken(token)
      return
    } catch (err) {
      lastError = err
      await delay(500 * attempt)
    }
  }
  throw lastError
}

export function attachNotificationListeners() {
  const received = Notifications.addNotificationReceivedListener(() => {
    // no-op for now
  })
  const response = Notifications.addNotificationResponseReceivedListener((resp) => {
    handleNotificationResponse(resp)
  })
  void handleInitialNotificationResponse()
  return () => {
    received.remove()
    response.remove()
  }
}

async function handleInitialNotificationResponse() {
  const response = await Notifications.getLastNotificationResponseAsync()
  if (response) handleNotificationResponse(response)
}

function handleNotificationResponse(
  resp: Notifications.NotificationResponse,
) {
  const data = resp.notification.request.content.data as Record<string, unknown> | undefined
  const type = typeof data?.type === "string" ? (data.type as string) : ""
  const taskId = typeof data?.taskId === "string" ? (data.taskId as string) : ""
  if (type.startsWith("TASK_") && taskId) {
    navigate("OolshikDetail", { id: taskId })
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
