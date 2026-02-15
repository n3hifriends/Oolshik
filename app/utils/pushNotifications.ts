import { Platform } from "react-native"
import * as Notifications from "expo-notifications"

import { OolshikApi } from "@/api/client"
import { navigate, navigationRef, resetRoot } from "@/navigators/navigationUtilities"
import { loadString, saveString, remove } from "@/utils/storage"

const PUSH_TOKEN_KEY = "push.token"
const PUSH_PERMISSION_REQUESTED_KEY = "push.permission.requested"
const ONBOARDING_COMPLETE_KEY = "onboarding.v1.completed"
const NAV_READY_RETRY_DELAY_MS = 150
const NAV_READY_MAX_RETRIES = 40

type PendingNotificationTarget = {
  taskId: string
}

type RouteLike = {
  name?: string
  params?: unknown
}

let pendingTarget: PendingNotificationTarget | null = null
let navRetryTimer: ReturnType<typeof setTimeout> | null = null
let navRetryCount = 0
let lastHandledResponseIdentifier: string | null = null

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
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

export async function unregisterDeviceToken(token: string) {
  await OolshikApi.unregisterDevice(token)
}

export async function unregisterDeviceTokenWithRetry(token: string, maxAttempts = 2) {
  let lastError: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await unregisterDeviceToken(token)
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
  flushPendingTarget()

  return () => {
    received.remove()
    response.remove()
    clearNavRetryTimer()
  }
}

async function handleInitialNotificationResponse() {
  const response = await Notifications.getLastNotificationResponseAsync()
  if (!response) return

  handleNotificationResponse(response)
  void Notifications.clearLastNotificationResponseAsync().catch(() => {
    // best-effort
  })
}

function handleNotificationResponse(resp: Notifications.NotificationResponse) {
  const responseIdentifier =
    typeof resp.notification.request.identifier === "string"
      ? resp.notification.request.identifier
      : null

  // Avoid duplicate navigation when both "last response" and listener callbacks fire.
  if (responseIdentifier && responseIdentifier === lastHandledResponseIdentifier) {
    return
  }
  lastHandledResponseIdentifier = responseIdentifier

  const data = resp.notification.request.content.data as Record<string, unknown> | undefined
  const type = typeof data?.type === "string" ? data.type : ""
  const taskId = typeof data?.taskId === "string" ? data.taskId : ""

  if (!type.startsWith("TASK_") || !taskId) return

  pendingTarget = { taskId }
  navRetryCount = 0
  flushPendingTarget()
}

function flushPendingTarget() {
  if (!pendingTarget) return

  if (!navigationRef.isReady()) {
    scheduleNavRetry()
    return
  }

  const { taskId } = pendingTarget
  pendingTarget = null
  clearNavRetryTimer()

  openTaskDetailFromNotification(taskId)
}

function openTaskDetailFromNotification(taskId: string) {
  const activeRoute = getActiveOolshikRoute()

  // If already on the same detail, ignore the duplicate action.
  if (
    activeRoute?.name === "OolshikDetail" &&
    typeof (activeRoute.params as { id?: unknown } | undefined)?.id === "string" &&
    (activeRoute.params as { id: string }).id === taskId
  ) {
    return
  }

  if (shouldResetStackForNotification()) {
    resetToNotificationStack(taskId)
    return
  }

  navigate("Oolshik", { screen: "OolshikDetail", params: { id: taskId } })
}

function shouldResetStackForNotification() {
  if (!navigationRef.isReady()) return true

  const rootState = navigationRef.getRootState()
  const rootRoute = rootState.routes[rootState.index ?? 0] as
    | { name?: string; state?: unknown }
    | undefined
  if (!rootRoute || rootRoute.name !== "Oolshik") return true

  const nestedState = rootRoute.state as { routes?: RouteLike[] } | undefined
  const nestedRoutes = Array.isArray(nestedState?.routes) ? nestedState!.routes! : []

  // Cold-start / minimal stack state should be reset to enforce back behavior.
  return nestedRoutes.length <= 1
}

function resetToNotificationStack(taskId: string) {
  const baseRoute = getResetBaseRoute()

  // The navigation ref only knows top-level route types, so nested reset state needs a cast.
  resetRoot({
    index: 0,
    routes: [
      {
        name: "Oolshik" as never,
        state: {
          index: 1,
          routes: [
            { name: baseRoute.name, ...(baseRoute.params ? { params: baseRoute.params } : {}) },
            { name: "OolshikDetail", params: { id: taskId } },
          ],
        } as never,
      },
    ],
  } as never)
}

function getResetBaseRoute(): { name: string; params?: unknown } {
  const activeRoute = getActiveOolshikRoute()

  if (activeRoute?.name && activeRoute.name !== "OolshikDetail") {
    return { name: activeRoute.name, params: activeRoute.params }
  }

  const onboardingComplete = loadString(ONBOARDING_COMPLETE_KEY) === "true"
  return { name: onboardingComplete ? "OolshikHome" : "OolshikOnboard" }
}

function getActiveOolshikRoute(): RouteLike | null {
  if (!navigationRef.isReady()) return null

  const rootState = navigationRef.getRootState()
  const rootRoute = rootState.routes[rootState.index ?? 0] as
    | { name?: string; state?: unknown }
    | undefined
  if (!rootRoute || rootRoute.name !== "Oolshik") return null

  const nestedState = rootRoute.state as { routes?: RouteLike[]; index?: number } | undefined
  const nestedRoutes = Array.isArray(nestedState?.routes) ? nestedState!.routes! : []
  if (!nestedRoutes.length) return null

  const nestedIndex = nestedState?.index ?? nestedRoutes.length - 1
  return nestedRoutes[nestedIndex] ?? null
}

function scheduleNavRetry() {
  if (navRetryTimer) return

  if (navRetryCount >= NAV_READY_MAX_RETRIES) {
    pendingTarget = null
    return
  }

  navRetryTimer = setTimeout(() => {
    navRetryTimer = null
    navRetryCount += 1
    flushPendingTarget()
  }, NAV_READY_RETRY_DELAY_MS)
}

function clearNavRetryTimer() {
  if (!navRetryTimer) return
  clearTimeout(navRetryTimer)
  navRetryTimer = null
}

export function getCachedPushToken() {
  return loadString(PUSH_TOKEN_KEY)
}

export function setCachedPushToken(token: string) {
  saveString(PUSH_TOKEN_KEY, token)
}

export function clearCachedPushToken() {
  remove(PUSH_TOKEN_KEY)
}

export async function enablePushNotifications() {
  const token = await getExpoPushTokenAsync()
  if (!token) return null
  const cached = getCachedPushToken()
  if (token === cached) return token
  await registerDeviceTokenWithRetry(token)
  setCachedPushToken(token)
  return token
}

export async function disablePushNotifications() {
  const cached = getCachedPushToken()
  if (!cached) return
  try {
    await unregisterDeviceTokenWithRetry(cached)
  } finally {
    clearCachedPushToken()
  }
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
