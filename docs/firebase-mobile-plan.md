# Firebase Mobile Integration Plan
## Crashlytics · Analytics · Remote Config

**App:** Oolshik React Native (Expo + EAS)
**Repo:** `/Users/nitinkalokhe/Ni3/Oolshik`
**Package manager:** `yarn` (prefer over npm — both lockfiles exist, yarn.lock is primary)

---

## Pre-requisites

Already satisfied in this repo — do not repeat:

- [x] `@react-native-firebase/app` ^23.4.0 installed
- [x] `@react-native-firebase/auth` ^23.4.0 installed
- [x] `@react-native-firebase/messaging` 23.4.0 installed
- [x] `expo-build-properties` ~0.14.6 installed (not yet configured — see Step 2)
- [x] `google-services.json` present at repo root
- [x] `GoogleService-Info.plist` present at repo root
- [x] EAS builds configured (`eas.json`)
- [x] Firebase Console project exists (`oolshik`)
- [x] Android package: `com.oolshik.aan` · iOS bundle: `com.oolshik.aan`
- [x] Crashlytics scaffold exists at `app/utils/crashReporting.ts`

---

## Step 1 — Install Native Firebase Modules

Pin to `^23.4.0` to match existing `@react-native-firebase` versions:

```bash
yarn add @react-native-firebase/analytics@^23.4.0
yarn add @react-native-firebase/crashlytics@^23.4.0
yarn add @react-native-firebase/remote-config@^23.4.0
```

---

## Step 2 — Update `app.config.ts`

**File:** [`app.config.ts`](../app.config.ts)

Two changes required:

### 2a — Add RNFirebase plugins

Append after the existing `@react-native-firebase/messaging` plugin:

```ts
"@react-native-firebase/crashlytics",  // configures Gradle plugin + iOS dSYM upload phase
```

`@react-native-firebase/analytics` and `@react-native-firebase/remote-config` do NOT have Expo config plugins — they auto-link via React Native's native module system. Adding them to `plugins` causes a `PluginError` at build time. Only `crashlytics` needs a plugin entry.

### 2b — Configure iOS static frameworks via `expo-build-properties`

`expo-build-properties` is already installed but not yet configured in `app.config.ts`. React Native Firebase requires iOS static framework linkage. Add:

```ts
[
  "expo-build-properties",
  {
    ios: {
      useFrameworks: "static",
    },
  },
],
```

Without this, the iOS prebuild will produce dynamic framework linkage that causes Firebase module load failures at runtime.

---

## Step 3 — Delete `app/services/firebase.ts`

**File:** [`app/services/firebase.ts`](../app/services/firebase.ts)

This file is **never imported anywhere in the app** — confirmed by a full repo search. It exports `firebaseApp`, `firebaseAuth`, and (incorrectly) a web SDK `analytics` instance that silently no-ops in React Native. The OTP flow uses the backend endpoints `/auth/otp/request` and `/auth/otp/verify`, not Firebase client auth.

Delete the file entirely. The `firebase` web SDK dependency in `package.json` can also be removed unless web platform support (`expo start --web`) is still required for development.

---

## Step 4 — Create Analytics Service

**File:** [`app/services/analytics.ts`](../app/services/analytics.ts) *(new)*

Thin wrappers over `@react-native-firebase/analytics`. Disable data collection in `__DEV__` to avoid polluting production dashboards.

**Shape:**
- `logEvent(name: string, params?: Record<string, unknown>): void`
- `logScreenView(screenName: string, screenClass?: string): void`
- `setUserId(userId: string | null): void`
- `setUserProperty(name: string, value: string | null): void`
- At module load: `if (__DEV__) analytics().setAnalyticsCollectionEnabled(false)`

**Events to track** (no PII — never log phone number, email, name, JWT, address, raw location, or backend payloads):

| Event Name | Trigger |
|---|---|
| `app_session_started` | App opens / foregrounds |
| `login_started` | User taps any login button |
| `login_success` | JWT issued, user lands on home |
| `login_failed` | Auth error returned |
| `otp_requested` | OTP send triggered |
| `otp_verified` | OTP verified successfully |
| `otp_failed` | OTP verification error |
| `google_login_success` | Google sign-in completes |
| `google_login_failed` | Google sign-in error |
| `logout` | User logs out |
| `help_request_created` | New help request submitted |
| `help_request_accepted` | Request accepted |
| `help_request_completed` | Request completed |
| `help_request_cancelled` | Request cancelled |
| `location_permission_granted` | OS permission granted |
| `location_permission_denied` | OS permission denied |
| `push_permission_granted` | Push notification permission granted |
| `push_permission_denied` | Push notification permission denied |

---

## Step 5 — Implement `app/utils/crashReporting.ts`

**File:** [`app/utils/crashReporting.ts`](../app/utils/crashReporting.ts) *(update existing)*

This file already exists as an Ignite scaffold with `initCrashReporting()`, `reportCrash()`, and `ErrorType`. The Crashlytics lines are commented out. Implement them.

**Changes:**
- Uncomment `import crashlytics from "@react-native-firebase/crashlytics"`
- In `initCrashReporting()`: call `crashlytics().setCrashlyticsCollectionEnabled(!__DEV__)`
- In `reportCrash()` else-block: call `crashlytics().recordError(error)`
- Add `setUserId(userId: string): void` — calls `crashlytics().setUserId(userId)`
- Add `clearUserId(): void` — calls `crashlytics().setUserId("")`
- Add `log(message: string): void` — calls `crashlytics().log(message)` for breadcrumbs
- Add `setAttribute(key: string, value: string): void` — calls `crashlytics().setAttribute(key, value)`

**Breadcrumbs to log:**
- Current screen name (from navigation state change)
- Auth state transitions: `"auth:logged_in"`, `"auth:logged_out"`
- App environment (`local`, `dev`, `prod`)
- Internal help request ID only (no user data)

---

## Step 6 — Create Remote Config Service

**File:** [`app/services/remoteConfig.ts`](../app/services/remoteConfig.ts) *(new)*

### Flag interface and defaults

Define defaults that mirror the current hardcoded values — a fetch failure is invisible to users:

```ts
interface RemoteConfigFlags {
  // Auth — mirrors config.base.ts
  AUTH_PHONE_OTP_ENABLED: boolean         // default: false
  AUTH_GOOGLE_ENABLED: boolean            // default: true
  AUTH_GOOGLE_REQUIRE_PHONE: boolean      // default: true
  REQUIRE_PRESIGNED_AUDIO_UPLOAD: boolean // default: false

  // Feature flags — mirrors flags.ts
  USE_MOCK_NEARBY: boolean                // default: false
  USE_MOCK_UPLOAD_CREATE: boolean         // default: false

  // Ops flags (set live in Firebase Console)
  MAINTENANCE_MODE_ENABLED: boolean       // default: false
  MAINTENANCE_MESSAGE: string             // default: ""
  MINIMUM_SUPPORTED_APP_VERSION: string   // default: "0.0.0"
  HELP_REQUEST_POLL_INTERVAL_MS: number   // default: 10000
  ENABLE_LOCATION_TRACKING: boolean       // default: true
  ENABLE_PUSH_NOTIFICATIONS: boolean      // default: true
}
```

### Functions

- `initRemoteConfig(): Promise<void>` — sets `minimumFetchIntervalMillis` (`0` in dev / `3600000` in prod), calls `setDefaults(REMOTE_CONFIG_DEFAULTS)`, calls `fetchAndActivate()`, swallows errors with `console.warn` so a network failure never blocks startup
- `getRemoteFlag<K extends keyof RemoteConfigFlags>(key: K): RemoteConfigFlags[K]` — synchronous reader after activation

### Remote Config and existing `flags.ts` — important constraint

**Do not replace static values in `flags.ts` with synchronous `getRemoteFlag()` calls at module load time.** `fetchAndActivate()` is async; module-load reads will only ever return defaults and will never re-render consumers when a fetch completes.

**Correct approach:**
- Keep `FLAGS` in `flags.ts` as the compile-time fallback (unchanged)
- Export `useRemoteConfig(): RemoteConfigFlags` hook from `remoteConfig.ts` that reads all flags and returns a plain object — components that need live Remote Config values call this hook
- For the new ops flags (`MAINTENANCE_MODE_ENABLED`, `MINIMUM_SUPPORTED_APP_VERSION`, etc.), consume via `useRemoteConfig()` in the relevant screen/component, not via `FLAGS`

This means existing consumers of `FLAGS` are unaffected and do not need to change in this integration pass.

---

## Step 7 — Wire Up Services at Startup

### `initCrashReporting` — [`app/app.tsx`](../app/app.tsx)

`initCrashReporting` is defined but never called. Add the import and call it before `registerRootComponent`:

```ts
import { initCrashReporting } from "./utils/crashReporting"
initCrashReporting()
```

### Remote Config — [`index.tsx`](../index.tsx)

Call `initRemoteConfig()` fire-and-forget before `registerRootComponent(App)`:

```ts
import { initRemoteConfig } from "@/services/remoteConfig"
initRemoteConfig()
registerRootComponent(App)
```

### Analytics + Crashlytics user identity — [`app/context/AuthContext.tsx`](../app/context/AuthContext.tsx)

Use raw `userId` + `isAuthenticated`, **not `effectiveUserId`** — `effectiveUserId` falls back to `"U-LOCAL-1"` when logged out, which would attach a fake ID to every analytics event and crash report.

```ts
useEffect(() => {
  if (isAuthenticated && userId) {
    analyticsService.setUserId(userId)
    crashReporting.setUserId(userId)
    crashReporting.setAttribute("env", Config.ENV ?? "unknown")
  } else {
    analyticsService.setUserId(null)
    crashReporting.clearUserId()
  }
}, [isAuthenticated, userId])
```

---

## Step 8 — Screen Tracking

**File:** [`app/navigators/navigationUtilities.ts`](../app/navigators/navigationUtilities.ts)

The existing `onNavigationStateChange` callback has an `if (currentRouteName !== previousRouteName)` block. Augment it:

```ts
if (currentRouteName !== previousRouteName) {
  logScreenView(currentRouteName)
  crashReporting.log(`screen:${currentRouteName}`)
  if (__DEV__) console.log(currentRouteName)
}
```

---

## Step 9 — JS Error Reporting

**File:** [`app/screens/ErrorScreen/ErrorBoundary.tsx`](../app/screens/ErrorScreen/ErrorBoundary.tsx)

Line 42 has `// reportCrash(error)` already. Uncomment and pass context:

```ts
componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
  reportCrash(error, ErrorType.FATAL)
  // optionally: crashReporting.setAttribute("componentStack", errorInfo?.componentStack ?? "")
}
```

This uses the existing `reportCrash` function from `crashReporting.ts` — no new import path.

---

## Step 10 — Backend Coordination

No backend auth architecture change is required for this integration.

Backend changes are only needed in future if:
- **Version enforcement** — server rejects requests below `MINIMUM_SUPPORTED_APP_VERSION`
- **Event ingestion** — backend consumes analytics events for audit trails
- **Firebase identity tokens** — replacing current JWT auth with Firebase ID tokens (currently not the active identity provider per `docs/ai/current-auth-state.md`)

---

## Step 11 — Native Build Steps

### EAS Cloud Builds (recommended path)

EAS runs `expo prebuild` and `pod install` automatically. After pushing updated `app.config.ts` and new packages, the next `eas build` handles everything.

### Local iOS Build

```bash
expo prebuild --no-install
cd ios && pod install
```

`expo prebuild` is required (not just `pod install`) because the Crashlytics Expo plugin injects the dSYM upload build phase into the Xcode project.

### Local Android Build

```bash
expo prebuild
npx expo run:android
```

The Crashlytics Gradle plugin is applied by the Expo config plugin during prebuild.

---

## Step 12 — Verification Checklist

### Analytics

- [ ] Enable Firebase DebugView in the console
- [ ] Android debug mode:
  ```bash
  adb shell setprop debug.firebase.analytics.app com.oolshik.aan
  ```
- [ ] iOS debug mode: add `-FIRDebugEnabled` to Xcode scheme launch arguments
- [ ] Trigger login flow — confirm `login_started`, `login_success` appear in DebugView
- [ ] Navigate screens — confirm `screen_view` events fire with correct route names

### Crashlytics

- [ ] In a dev/internal build only, force a test crash: `crashlytics().crash()`
- [ ] Reopen the app — Crashlytics uploads on next launch
- [ ] Confirm crash appears in Firebase Console → Crashlytics within ~5 minutes
- [ ] Confirm user ID is attached to the crash report
- [ ] Confirm crash does NOT appear when `__DEV__` is true (collection disabled)

### Remote Config

- [ ] Set `MAINTENANCE_MODE_ENABLED = true` in Firebase Console
- [ ] Kill and relaunch the app
- [ ] Confirm `useRemoteConfig().MAINTENANCE_MODE_ENABLED` returns `true`
- [ ] In dev builds, confirm `minimumFetchIntervalMillis = 0` gives instant updates without restart

### Smoke Tests After Integration

- [ ] Login with Google
- [ ] Login with phone OTP (if enabled)
- [ ] Logout and re-login
- [ ] Protected API call succeeds after login
- [ ] Push notification received (FCM — existing messaging unaffected)
- [ ] Location permission flow works
- [ ] No crash on cold launch

---

## Summary of File Changes

| File | Change | Note |
|---|---|---|
| `package.json` | +3 packages via `yarn add` | Match ^23.4.0 |
| `app.config.ts` | +2 plugin entries + `expo-build-properties` iOS static config | Static frameworks required for RNFirebase iOS |
| `app/services/firebase.ts` | **Delete** | Never imported; web SDK analytics broken in RN |
| `app/services/analytics.ts` | New | Analytics wrappers |
| `app/services/remoteConfig.ts` | New | Remote Config service with typed flags, defaults, init, hook |
| `app/utils/crashReporting.ts` | Edit existing | Uncomment Crashlytics; add `setUserId`, `clearUserId`, `log`, `setAttribute` |
| `index.tsx` | +2 lines | Fire-and-forget `initRemoteConfig()` |
| `app/app.tsx` | +2 lines | Call `initCrashReporting()` at startup |
| `app/context/AuthContext.tsx` | +1 `useEffect` | Sync real `userId` + `isAuthenticated` to both services |
| `app/navigators/navigationUtilities.ts` | ~3 lines | `logScreenView` + crashlytics breadcrumb |
| `app/screens/ErrorScreen/ErrorBoundary.tsx` | Uncomment line 42 | `reportCrash` already imported via existing scaffold |
