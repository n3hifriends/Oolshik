import * as Notifications from "expo-notifications"
import { Platform } from "react-native"
import { OolshikApi } from "@/api/client"
import { navigate } from "@/navigators/navigationUtilities"
import { loadString, saveString } from "@/utils/storage"

const PUSH_TOKEN_KEY = "push.token"
const PUSH_PERMISSION_REQUESTED_KEY = "push.permission.requested"

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

export async function getExpoPushTokenAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null
  await ensureAndroidChannel()
  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  const askedBefore = loadString(PUSH_PERMISSION_REQUESTED_KEY) === "true"
  if (existingStatus !== "granted" && !askedBefore) {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
    saveString(PUSH_PERMISSION_REQUESTED_KEY, "true")
  }
  if (finalStatus !== "granted") return null

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.log("expo push token acquired")
    }
    return token
  } catch {
    return null
  }
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

function handleNotificationResponse(resp: Notifications.NotificationResponse) {
  const data = resp.notification.request.content.data as Record<string, unknown> | undefined
  const type = typeof data?.type === "string" ? (data.type as string) : ""
  const taskId = typeof data?.taskId === "string" ? (data.taskId as string) : ""
  if (type.startsWith("TASK_") && taskId) {
    navigate("OolshikDetail", { id: taskId })
  }
}

export function getCachedPushToken() {
  return loadString(PUSH_TOKEN_KEY)
}

export function setCachedPushToken(token: string) {
  saveString(PUSH_TOKEN_KEY, token)
}

async function ensureAndroidChannel() {
  if (Platform.OS !== "android") return
  await Notifications.setNotificationChannelAsync("default", {
    name: "default",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#191015",
  })
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
