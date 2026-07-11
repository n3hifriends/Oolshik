import { Platform, PermissionsAndroid } from "react-native"
import { getApp } from "@react-native-firebase/app"
import {
  getMessaging,
  requestPermission,
  hasPermission,
  getToken,
  onMessage,
  AuthorizationStatus,
} from "@react-native-firebase/messaging"
import type { FirebaseMessagingTypes } from "@react-native-firebase/messaging"
import * as Notifications from "expo-notifications"

// Cached modular Messaging instance.
const messagingInstance = getMessaging(getApp())

import { OolshikApi } from "@/api/client"
import { navigate, navigationRef, resetRoot } from "@/navigators/navigationUtilities"
import { loadString, saveString, remove } from "@/utils/storage"
import { breadcrumb } from "@/utils/crashReporting"

const PUSH_TOKEN_KEY = "push.token"
const PUSH_PERMISSION_REQUESTED_KEY = "push.permission.requested"
const ONBOARDING_COMPLETE_KEY = "onboarding.v1.completed"
const NAV_READY_RETRY_DELAY_MS = 150
const NAV_READY_MAX_RETRIES = 40

type NotifRoute = "TaskDetail" | "PaymentPay" | "AdminBroadcast" | "InAppInbox"

type PendingNotificationTarget = {
  route: NotifRoute
  taskId?: string
  paymentRequestId?: string
  broadcastId?: string
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

async function requestNotifPermission(): Promise<FirebaseMessagingTypes.AuthorizationStatus> {
  if (Platform.OS === "android" && Number(Platform.Version) >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    )
    return result === PermissionsAndroid.RESULTS.GRANTED
      ? AuthorizationStatus.AUTHORIZED
      : AuthorizationStatus.DENIED
  }
  return requestPermission(messagingInstance)
}

export async function getFcmTokenAsync(): Promise<string | null> {
  if (Platform.OS === "web") return null
  await ensureAndroidChannel()

  const stored = loadString(PUSH_PERMISSION_REQUESTED_KEY)
  if (!stored) {
    const authStatus = await requestNotifPermission()
    const granted =
      authStatus === AuthorizationStatus.AUTHORIZED ||
      authStatus === AuthorizationStatus.PROVISIONAL
    saveString(PUSH_PERMISSION_REQUESTED_KEY, granted ? "granted" : "denied")
    if (!granted) return null
  } else {
    const authStatus = await hasPermission(messagingInstance)
    if (authStatus === AuthorizationStatus.NOT_DETERMINED) {
      // Stale stored state — system hasn't been asked yet (e.g. reinstall from iCloud/Android backup).
      const fresh = await requestNotifPermission()
      const granted =
        fresh === AuthorizationStatus.AUTHORIZED || fresh === AuthorizationStatus.PROVISIONAL
      saveString(PUSH_PERMISSION_REQUESTED_KEY, granted ? "granted" : "denied")
      if (!granted) return null
    } else {
      const granted =
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL
      if (granted && stored === "denied") {
        saveString(PUSH_PERMISSION_REQUESTED_KEY, "granted")
      }
      if (!granted) return null
    }
  }

  try {
    const token = await getToken(messagingInstance)
    return token
  } catch {
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.warn("FCM token acquisition failed")
    }
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
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(`push token registration failed; retrying (${attempt}/${maxAttempts})`, err)
      }
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
  const foregroundFcm = onMessage(messagingInstance, handleForegroundFcmMessage)
  const received = Notifications.addNotificationReceivedListener(() => {
    // no-op for now
  })
  const response = Notifications.addNotificationResponseReceivedListener((resp) => {
    handleNotificationResponse(resp)
  })

  void handleInitialNotificationResponse()
  flushPendingTarget()

  return () => {
    foregroundFcm()
    received.remove()
    response.remove()
    clearNavRetryTimer()
  }
}

async function handleForegroundFcmMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage) {
  const title =
    remoteMessage.notification?.title ||
    getStringDataValue(remoteMessage.data, "title") ||
    "Oolshik"
  const body =
    remoteMessage.notification?.body ||
    getStringDataValue(remoteMessage.data, "body") ||
    getStringDataValue(remoteMessage.data, "message") ||
    ""

  if (!title && !body) return

  await ensureAndroidChannel()
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      // Carry full FCM data so tap routing works after the local notification is pressed
      data: (remoteMessage.data as Record<string, unknown>) ?? {},
    },
    trigger: null,
  })
}

function getStringDataValue(
  data: FirebaseMessagingTypes.RemoteMessage["data"],
  key: string,
): string | null {
  const value = data?.[key]
  return typeof value === "string" && value.trim().length > 0 ? value : null
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

  if (responseIdentifier && responseIdentifier === lastHandledResponseIdentifier) {
    return
  }
  lastHandledResponseIdentifier = responseIdentifier

  const data = resp.notification.request.content.data as Record<string, unknown> | undefined
  const route = typeof data?.route === "string" ? (data.route as string) : ""
  const type = typeof data?.type === "string" ? data.type : ""
  const taskId = typeof data?.taskId === "string" ? data.taskId : ""
  const paymentRequestId = typeof data?.paymentRequestId === "string" ? data.paymentRequestId : ""
  const broadcastId = typeof data?.broadcastId === "string" ? data.broadcastId : ""

  let target: PendingNotificationTarget | null = null

  if (route === "TaskDetail" && taskId) {
    target = { route: "TaskDetail", taskId }
  } else if (route === "PaymentPay" && taskId) {
    // PaymentPay screen requires a QR scan payload — navigate to task detail instead,
    // which surfaces the payment section and lets the user act from there.
    target = { route: "TaskDetail", taskId, paymentRequestId: paymentRequestId || undefined }
  } else if (route === "AdminBroadcast") {
    target = { route: "AdminBroadcast", broadcastId: broadcastId || undefined }
  } else if (route === "InAppInbox") {
    target = { route: "InAppInbox" }
  } else if (type.startsWith("TASK_") && taskId) {
    // Fallback for legacy payloads that carry type but no route
    target = { route: "TaskDetail", taskId }
  }

  if (!target) {
    breadcrumb(`nav:notification_open_failed route=${route || "none"} type=${type || "none"}`)
    return
  }

  breadcrumb(`nav:notification_open target=${target.route} has_payment=${!!paymentRequestId}`)
  pendingTarget = target
  navRetryCount = 0
  flushPendingTarget()
}

function flushPendingTarget() {
  if (!pendingTarget) return

  if (!navigationRef.isReady()) {
    scheduleNavRetry()
    return
  }

  const target = pendingTarget
  pendingTarget = null
  clearNavRetryTimer()

  switch (target.route) {
    case "TaskDetail":
      if (target.taskId) openTaskDetailFromNotification(target.taskId)
      break
    case "AdminBroadcast":
    case "InAppInbox":
      openInboxFromNotification()
      break
  }
}

function openTaskDetailFromNotification(taskId: string) {
  const activeRoute = getActiveOolshikRoute()

  if (
    activeRoute?.name === "OolshikDetail" &&
    typeof (activeRoute.params as { id?: unknown } | undefined)?.id === "string" &&
    (activeRoute.params as { id: string }).id === taskId
  ) {
    return
  }

  if (shouldResetStackForNotification()) {
    resetToTaskDetailStack(taskId)
    return
  }

  navigate("Oolshik", { screen: "OolshikDetail", params: { id: taskId } })
}

function openInboxFromNotification() {
  const activeRoute = getActiveOolshikRoute()
  if (activeRoute?.name === "NotificationInbox") return

  if (shouldResetStackForNotification()) {
    resetToInboxStack()
    return
  }

  navigate("Oolshik", { screen: "NotificationInbox", params: undefined })
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

  return nestedRoutes.length <= 1
}

function resetToTaskDetailStack(taskId: string) {
  const baseRoute = getResetBaseRoute()

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

function resetToInboxStack() {
  const baseRoute = getResetBaseRoute()

  resetRoot({
    index: 0,
    routes: [
      {
        name: "Oolshik" as never,
        state: {
          index: 1,
          routes: [
            { name: baseRoute.name, ...(baseRoute.params ? { params: baseRoute.params } : {}) },
            { name: "NotificationInbox" },
          ],
        } as never,
      },
    ],
  } as never)
}

function getResetBaseRoute(): { name: string; params?: unknown } {
  const activeRoute = getActiveOolshikRoute()

  if (
    activeRoute?.name &&
    activeRoute.name !== "OolshikDetail" &&
    activeRoute.name !== "NotificationInbox"
  ) {
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
    breadcrumb(`nav:notification_routing_failed target=${pendingTarget?.route ?? "none"}`)
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

export function getNotificationPermissionState(): "unknown" | "granted" | "denied" {
  const stored = loadString(PUSH_PERMISSION_REQUESTED_KEY)
  if (!stored) return "unknown"
  return stored === "granted" ? "granted" : "denied"
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
  const token = await getFcmTokenAsync()
  if (!token) return null
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
