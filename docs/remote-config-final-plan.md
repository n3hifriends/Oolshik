# Remote Config — Final Implementation Plan

**App:** Oolshik React Native (Expo + EAS)
**Service:** `app/services/remoteConfig.ts` — initialized, defaults set, `useRemoteConfig()` hook ready

---

## Safety Constraint (non-negotiable)

Remote Config is a **UX and control-plane layer only**. It must never be the sole enforcement point for:

- Authentication or authorization decisions
- Security-sensitive permissions
- Pricing or entitlement logic
- Any decision that must be enforced server-side

All backend APIs continue enforcing their own rules regardless of Remote Config values. A compromised or spoofed config value must not create a security hole.

---

## 1. Key Naming Convention

All flag keys use **lowercase snake_case** throughout — both in the TypeScript interface and Firebase Console. This is the Firebase Remote Config convention and avoids confusion with `Config.*` environment variables (which use SCREAMING_SNAKE_CASE by convention).

The existing `remoteConfig.ts` interface (`AUTH_PHONE_OTP_ENABLED`, etc.) will be migrated to the new names as part of this implementation.

---

## 2. Full Key Registry

### Feature Flags
Control feature availability without an app release.

| Key | Type | Default | Consumer | Safe to change without release |
|---|---|---|---|---|
| `feature_help_requests_enabled` | boolean | `true` | `AppNavigator.tsx` | Yes |
| `feature_audio_upload_enabled` | boolean | `true` | `audio/uploadAudio.ts` | Yes |
| `feature_location_capture_enabled` | boolean | `true` | `hooks/useForegroundLocation.ts` | Yes |
| `feature_push_registration_enabled` | boolean | `true` | `context/AuthContext.tsx` | Yes |

### Auth Flags
Control login method availability — UX only; backend still validates tokens.

| Key | Type | Default | Consumer | Safe to change without release |
|---|---|---|---|---|
| `auth_phone_otp_enabled` | boolean | `false` | `screens/login/useLoginScreenController.ts` | Yes |
| `auth_google_enabled` | boolean | `true` | `screens/login/useLoginScreenController.ts` | Yes |
| `auth_google_require_phone` | boolean | `true` | `screens/login/useLoginScreenController.ts` | Yes |

### UI / Content Tuning
Dynamic strings and banners without a release.

| Key | Type | Default | Consumer | Safe to change without release |
|---|---|---|---|---|
| `home_banner_enabled` | boolean | `false` | Home screen | Yes |
| `home_banner_title` | string | `""` | Home screen | Yes |
| `home_banner_message` | string | `""` | Home screen | Yes |
| `support_contact_whatsapp` | string | `""` | Support/profile screen | Yes |
| `support_contact_email` | string | `""` | Support/profile screen | Yes |

### Operational Controls
App-wide gates and performance tuning.

| Key | Type | Default | Consumer | Safe to change without release |
|---|---|---|---|---|
| `maintenance_mode_enabled` | boolean | `false` | `AppNavigator.tsx` | Yes |
| `maintenance_message` | string | `""` | `MaintenanceScreen` | Yes |
| `min_supported_app_version_android` | string | `"0.0.0"` | `AppNavigator.tsx` | Yes |
| `min_supported_app_version_ios` | string | `"0.0.0"` | `AppNavigator.tsx` | Yes |
| `force_update_enabled` | boolean | `false` | `AppNavigator.tsx` | Yes |
| `audio_upload_use_presigned` | boolean | `false` | `audio/uploadAudio.ts` | Yes |
| `help_request_poll_interval_ms` | number | `10000` | `useTaskDetailController.tsx` | Yes |
| `remote_config_fetch_interval_seconds` | number | `3600` | `app/services/remoteConfig.ts` | Yes |

### Privacy / Observability Controls
Defaults match production-safe behavior.

| Key | Type | Default | Consumer | Safe to change without release |
|---|---|---|---|---|
| `analytics_debug_logging_enabled` | boolean | `false` | `app/services/analytics.ts` | Yes |
| `crashlytics_user_context_enabled` | boolean | `true` | `app/utils/crashReporting.ts` | Yes — default on; turn off for privacy-sensitive regions |

### Debug / Diagnostic Flags (dev/staging only)
All default to `false`. Must never be enabled in the production Firebase project.

| Key | Type | Default | Consumer | Safe to change without release |
|---|---|---|---|---|
| `mock_nearby_enabled` | boolean | `false` | `store/taskStore.ts` | Dev/staging only — see §5d |
| `mock_upload_create_enabled` | boolean | `false` | `app/api/index.ts` | Dev/staging only — see §5d |

---

## 3. Service Layer Updates (`app/services/remoteConfig.ts`)

The existing service already has `initRemoteConfig()`, `getRemoteFlag()`, and `useRemoteConfig()`. Three updates are needed:

### 3a. Rename keys to lowercase snake_case

Migrate the `RemoteConfigFlags` TypeScript interface from SCREAMING_SNAKE_CASE to the new lowercase key names. Update `DEFAULTS` to match. All existing `getRemoteFlag()` call sites update in lockstep.

### 3b. Add the new flags

Add all new keys from Section 2 to the `RemoteConfigFlags` interface and `DEFAULTS`.

### 3c. Add typed domain accessors

Instead of letting screens call `getRemoteFlag("key")` with raw strings, expose typed grouped accessors. Screens consume the accessor, not the raw key — Firebase becomes swappable, and keys stay out of the UI layer.

**Accessors to add:**

| Accessor | Returns | Groups |
|---|---|---|
| `isFeatureEnabled(key)` | `boolean` | The four `feature_*` flags |
| `getAuthConfig()` | `{ phoneOtpEnabled, googleEnabled, googleRequirePhone }` | The three `auth_*` flags |
| `getMaintenanceConfig()` | `{ enabled, message }` | `maintenance_mode_enabled`, `maintenance_message` |
| `getVersionConfig()` | `{ minAndroid, minIos, forceUpdateEnabled }` | The three version/update flags |
| `getBannerConfig()` | `{ enabled, title, message }` | The three `home_banner_*` flags |
| `getSupportContactConfig()` | `{ whatsapp, email }` | The two `support_contact_*` flags |

These accessors call `getRemoteFlag` internally. Components never touch a raw string key.

### 3d. Apply `remote_config_fetch_interval_seconds` with clamp

In `initRemoteConfig()`, after `fetchAndActivate()` completes, read `remote_config_fetch_interval_seconds` and apply it to subsequent fetches. **Clamp the value** before use:

- Minimum in production: `300` seconds (5 minutes) — prevents unintentional hammering of Firebase quota
- Maximum: `86400` seconds (24 hours)
- In `__DEV__`, always use `0` regardless of the remote value

Apply as `setConfigSettings({ minimumFetchIntervalMillis: clampedValue * 1000 })`. The first fetch always uses the hardcoded default (0 in dev / 3600s in prod), then the clamped remote value takes effect from the second fetch onward.

### 3e. Add `forceRefetchRemoteConfig()` for blocked screens

Expose a separate `forceRefetchRemoteConfig(): Promise<void>` function in `remoteConfig.ts` that:
1. Sets `minimumFetchIntervalMillis: 0` temporarily
2. Calls `fetchAndActivate()`
3. Notifies activation listeners (same as `initRemoteConfig`)

This is used by the `MaintenanceScreen` and `ForceUpdateScreen` Retry buttons. Calling `initRemoteConfig()` from those screens would respect the cached interval and may not fetch at all — `forceRefetchRemoteConfig()` bypasses the interval explicitly since the user has already waited and tapped retry.

---

## 4. Consumption Pattern

**Two approaches depending on context:**

| Context | Approach | Why |
|---|---|---|
| React component / hook | `useRemoteConfig()` then call accessor | Component re-renders when fetch activates |
| Non-React (store, utility fn, `useEffect` body) | `getRemoteFlag(key)` or accessor directly | Synchronous read; hook rules don't apply |

`Config.*` stays for build-time environment variables (`API_URL`, `GOOGLE_*_CLIENT_ID`). These are not replaced by Remote Config.

---

## 5. Integration Points (File-Level)

### 5a. Auth flags → `app/screens/login/useLoginScreenController.ts`

**Lines 76–78** currently read `Config.AUTH_PHONE_OTP_ENABLED`, `Config.AUTH_GOOGLE_ENABLED`, `Config.AUTH_GOOGLE_REQUIRE_PHONE`.

Replace all three with values from `useRemoteConfig()` at the top of the hook, then pass them into `getAuthConfig(flags)`.

**Why `useRemoteConfig()` here, not the synchronous accessor:** On first install, users land on the login screen while Remote Config fetch is still in flight. If the synchronous `getAuthConfig()` is called before activation completes, the login screen renders with defaults and never updates — the user may see the wrong auth options for the rest of that session. Using `useRemoteConfig()` ensures the component re-renders once when activation completes, showing the correct auth options.

**Effect:** Google login / OTP login / phone verification requirement all togglable from Firebase Console without a release, including on first install.

---

### 5b. Audio upload path → `app/audio/uploadAudio.ts`

**Lines 61 and 115** currently read `Config.REQUIRE_PRESIGNED_AUDIO_UPLOAD`.

Replace with `getRemoteFlag("audio_upload_use_presigned")`.

**Effect:** Presigned S3 upload vs. direct upload path switchable at runtime — useful for infrastructure migrations or emergency fallback.

**Note:** `uploadAudio.ts` is a plain async function, not a React component. Use `getRemoteFlag`, not the hook.

---

### 5c. Feature flag: audio upload → `app/audio/uploadAudio.ts`

At the entry point of the upload function, check `isFeatureEnabled("feature_audio_upload_enabled")`. If `false`, throw an early user-facing error or silently no-op depending on the UX decision.

---

### 5d. Mock flags → `app/store/taskStore.ts` and `app/api/index.ts`

**`taskStore.ts` lines 131, 181, 211** read `FLAGS.USE_MOCK_NEARBY`.
Replace with `getRemoteFlag("mock_nearby_enabled")`.

**`api/index.ts` line 5** has `FLAGS.USE_MOCK_UPLOAD_CREATE` commented out.
Uncomment and replace with `getRemoteFlag("mock_upload_create_enabled")`.

After migration, remove both keys from `app/config/flags.ts`. If the file is empty, delete it.

**Two-layer safety guard — both must be true for mock to activate:**

1. **App-side:** Wrap every mock flag read with an additional `__DEV__ || Config.ENV !== "production"` check. A Remote Config value of `true` in isolation is not enough — the app itself must also be in a non-production build. This means a misconfigured production Console entry cannot route real users into mock data paths.
2. **Console-side:** Set these keys under a condition restricted to dev/staging only (see §8). Console conditions are the second layer, not the only layer.

This two-layer approach ensures mock paths are unreachable in production regardless of Console state.

---

### 5e. Help request feature gate → `app/navigators/AppNavigator.tsx`

In the `AppStack` function (lines 59–100), before rendering `OolshikNavigator`, check `isFeatureEnabled("feature_help_requests_enabled")`. If `false`, hide or disable the help requests tab/stack.

**Note:** This is a UX gate only. The backend still enforces help request access.

---

### 5f. Maintenance gate → `app/navigators/AppNavigator.tsx` + new `MaintenanceScreen`

In `AppStack`, before the help request gate (5e), check `getMaintenanceConfig().enabled`. If `true`, render `MaintenanceScreen` instead of the full navigator.

**`MaintenanceScreen` requirements:**
- Full-screen, non-dismissable (no back gesture, no header)
- Displays `getMaintenanceConfig().message` with a hardcoded fallback ("We're performing maintenance. Please check back shortly.")
- "Retry" button that calls `forceRefetchRemoteConfig()` (not `initRemoteConfig()`) — this bypasses `minimumFetchIntervalMillis` so the retry actually contacts Firebase rather than returning the cached config, which would keep the user trapped until the interval expires
- The screen must be outside the auth navigator stack (applies to all users, including unauthenticated)

**File:** `app/screens/MaintenanceScreen.tsx` — new file

---

### 5g. Force update / version gate → `app/navigators/AppNavigator.tsx` + new `ForceUpdateScreen`

In `AppStack`, after the maintenance gate (5f), check version enforcement. Use **only version-based comparison** as the primary gate:

1. Compare `Application.nativeApplicationVersion` against `min_supported_app_version_android` (Android) or `min_supported_app_version_ios` (iOS) using `Platform.OS`.
2. Version comparison: split on `.`, compare major → minor → patch as integers. If device version is below minimum → show `ForceUpdateScreen`.
3. `force_update_enabled` acts as an **additional condition, not a standalone gate** — it must be `true` AND version must be below minimum. This prevents a single Console toggle from blocking all users on a mis-click. To force-update all users, raise the minimum version above any live build.

**Rollback path:** If the gate is incorrectly blocking users, set `min_supported_app_version_android` and `min_supported_app_version_ios` back to `"0.0.0"` in Firebase Console and set `force_update_enabled = false`. Changes propagate to active sessions via `forceRefetchRemoteConfig()` triggered by the Retry button on the update screen.

**Platform.OS detection:**
Use `Platform.OS === "android"` to pick the right min version key. Android and iOS release versions are always independent.

**`ForceUpdateScreen` requirements:**
- Full-screen, non-dismissable
- Shows current version and minimum required version
- "Update Now" button deep links to Play Store (Android) or App Store (iOS) using `Linking.openURL`
- Store URLs must be **build-time constants** in the app, not from Remote Config and not from `getSupportContactConfig()`. A broken Remote Config URL on this screen would trap users with no escape — hardcoded constants are the only safe option here.
- "Retry" button calls `forceRefetchRemoteConfig()` in case the Console was already reverted

**`Application.nativeApplicationVersion`** is already imported in `app/features/feedback/storage/feedbackQueue.ts` — same import pattern.

**File:** `app/screens/ForceUpdateScreen.tsx` — new file

**Default safety:** `min_supported_*_* = "0.0.0"` and `force_update_enabled = false` mean no user is ever blocked unless explicitly raised in Firebase Console.

---

### 5h. Poll interval → `app/screens/task-detail/hooks/useTaskDetailController.tsx`

**Line 79** has `TRANSCRIPTION_POLL_INTERVAL_MS = 5000` hardcoded. The `setInterval` at lines 329–348 uses this constant.

Replace `5000` with a clamped read of `getRemoteFlag("help_request_poll_interval_ms")` at the point the `useEffect` fires. **Clamp the value:**

- Minimum: `5000` ms — values below this could hammer the backend with rapid requests
- Maximum: `60000` ms (1 minute) — values above this make the feature effectively non-functional

Apply: `Math.min(Math.max(rawValue, 5000), 60000)`. Reading inside the effect is correct — it returns the currently-activated value synchronously.

**Effect:** Polling cadence tunable from Firebase Console — faster during high-traffic events, slower to reduce costs during quiet periods. Clamps ensure a bad Console value cannot cause a DoS or a broken UX.

---

### 5i. Home banner → Home screen component

The home screen (identify exact file during implementation) should call `getBannerConfig()` via `useRemoteConfig()`. If `enabled` is `true`, render a dismissable banner above the main content with `title` and `message`.

**Effect:** Announcements, feature introductions, or incident notices shown globally without a release.

---

### 5j. Support contact values → Support/profile screen

The support or profile screen should call `getSupportContactConfig()` via `useRemoteConfig()`. Render WhatsApp and email links from the remote values. If both are empty strings (default), hide the contact section or fall back to hardcoded values.

**Effect:** Support contact info updatable without a release — useful when switching support channels.

---

### 5k. Location tracking → `app/hooks/useForegroundLocation.ts`

**Line 39** unconditionally calls `Location.requestForegroundPermissionsAsync()`.

Read `isFeatureEnabled("feature_location_capture_enabled")` at the top of the hook via `useRemoteConfig()`. If `false`, skip the permission request entirely and return `{ location: null, hasPermission: false }`.

**Effect:** Location capture can be disabled globally — useful for regions, privacy compliance changes, or native crash isolation.

---

### 5l. Push registration → `app/context/AuthContext.tsx`

**Lines 116–131** unconditionally call `getFcmTokenAsync()` and `registerDeviceTokenWithRetry()`.

Wrap this block with `getRemoteFlag("feature_push_registration_enabled")`. If `false`, call the existing `disablePushNotifications()` utility instead.

Use `getRemoteFlag` (not the hook) here because this is inside a `useEffect` body — a synchronous read is appropriate and correct.

**Effect:** Push registration suppressable globally without a release — useful for emergency suppression or backend instability.

---

### 5m. Analytics debug logging → `app/services/analytics.ts`

Currently `analytics().setAnalyticsCollectionEnabled(false)` is called unconditionally in `__DEV__`. Add a `getRemoteFlag("analytics_debug_logging_enabled")` check: if `true`, enable collection even in dev (useful for QA and debug builds that need real DebugView output without changing code).

---

### 5n. Crashlytics user context → `app/utils/crashReporting.ts`

The `setUserId` and `setAttribute` calls in `crashReporting.ts` currently always execute. Wrap them with `getRemoteFlag("crashlytics_user_context_enabled")`. If `false`, user IDs and attributes are not sent — useful for privacy-sensitive environments or user opt-out flows.

---

## 6. Analytics Enrichment with Remote Config Values

After Remote Config activates, log a single `remote_config_activated` analytics event with selected non-sensitive flag values as event parameters:

- `maintenance_mode_enabled`
- `force_update_enabled`
- `feature_help_requests_enabled`
- `feature_audio_upload_enabled`
- Active auth methods (`google`, `otp`, or both)

Avoid logging full config payloads or user-identifying values.

---

## 7. Crashlytics Enrichment with Remote Config Values

After activation, call `crashReporting.setAttribute()` for:

- `rc_maintenance_mode` — `"true"` / `"false"`
- `rc_force_update` — `"true"` / `"false"`
- `rc_fetch_status` — `"activated"` / `"cached"` / `"failed"`
- `rc_feature_flags` — comma-separated list of enabled feature flags

This correlates crashes with active rollout state — makes it possible to see "this crash only started after maintenance_mode_enabled was set to true."

---

## 8. Firebase Console Setup

For each key:

1. Create the key with the default value matching `DEFAULTS` in `remoteConfig.ts`.
2. Add a description and owner team.
3. Use conditions for:
   - **Platform:** `app.id == 'com.oolshik.aan'` (Android) vs iOS bundle for platform-specific flags
   - **App version:** for flags that only apply to builds above a certain version
   - **Staged rollout:** use percentage conditions (5% → 25% → 100%) for any flag that could impact the main user flow
4. Publish only after the app-side default exists and is deployed.
5. Never delete a key that a live app version still reads — set it back to default instead.

**Conditions to set up first:**

| Condition name | Logic |
|---|---|
| `android_only` | `device.os == 'android'` |
| `ios_only` | `device.os == 'ios'` |
| `dev_builds_only` | App version contains `-dev`, or preferably use a separate Firebase project for staging |

**Note on iOS vs Android bundle IDs:** Both platforms use the same identifier `com.oolshik.aan` (confirmed in `app.json` lines 18 and 43). Differentiating by `app.id` alone does not separate platforms in this project. Use `device.os` conditions in Firebase Console for all platform-specific flag values (including `min_supported_app_version_android` vs `min_supported_app_version_ios`).

---

## 9. Rollout Order

Implement in this sequence — lowest risk to highest:

| Phase | Flags | Risk |
|---|---|---|
| 1 | Support contact values, home banner | No behavioral change risk; additive only |
| 2 | Auth flags, audio upload path, mock flags | Compile-time → runtime migration; defaults match current behavior |
| 3 | Poll interval, location gate, push gate | Touches permissions and polling; test on device |
| 4 | Analytics/Crashlytics enrichment | Observability only; no user-facing impact |
| 5 | Feature help requests gate, maintenance gate | App-wide UX gates; test with forced Console values first |
| 6 | Force update / version gate | Highest risk — blocks users; test with a version string higher than current app first |

---

## 10. Testing Scenarios

Before shipping any Remote Config gate to production, verify all of these:

| Scenario | Expected behavior |
|---|---|
| No network on first launch | App uses DEFAULTS; fully functional |
| Firebase Remote Config unavailable | Same as no network |
| Malformed flag value (wrong type) | `getRemoteFlag` type cast falls back to `0` / `false` / `""` for that type — **not** the `DEFAULTS` value. Numeric flags with clamps will be clamped to minimum if `0` is returned (e.g. poll interval → `5000` ms). Verify each numeric flag handles a `0` or empty value safely before shipping. |
| First install, no cached config | DEFAULTS applied; fetch runs in background |
| App upgrade | Previous cached config applies until next fetch |
| `maintenance_mode_enabled = true` | MaintenanceScreen shown, app blocked |
| `force_update_enabled = true` | ForceUpdateScreen shown, app blocked |
| `min_supported_*` above current version | ForceUpdateScreen shown |
| Feature flag `false` | Feature hidden or disabled; no crash |
| Remote Config fetch timeout | App continues with DEFAULTS or last cached |
| Flag activated mid-session | Applies on next cold launch (screens using `useRemoteConfig()` also update in current session) |

---

## 11. New Files Required

| File | Purpose |
|---|---|
| `app/screens/MaintenanceScreen.tsx` | Full-screen maintenance gate; non-dismissable |
| `app/screens/ForceUpdateScreen.tsx` | Full-screen force update gate; deep links to store |

---

## 12. All Files That Change

| File | Change |
|---|---|
| `app/services/remoteConfig.ts` | Rename keys to lowercase; add new flags; add typed domain accessors; apply `remote_config_fetch_interval_seconds` |
| `app/screens/login/useLoginScreenController.ts` | Replace 3 `Config.*` reads with `getAuthConfig()` |
| `app/audio/uploadAudio.ts` | Replace `Config.REQUIRE_PRESIGNED_AUDIO_UPLOAD` with `getRemoteFlag("audio_upload_use_presigned")`; add feature gate |
| `app/store/taskStore.ts` | Replace `FLAGS.USE_MOCK_NEARBY` at 3 lines with `getRemoteFlag("mock_nearby_enabled")` |
| `app/api/index.ts` | Uncomment and replace `FLAGS.USE_MOCK_UPLOAD_CREATE` with `getRemoteFlag("mock_upload_create_enabled")` |
| `app/config/flags.ts` | Remove migrated flags; delete if empty |
| `app/navigators/AppNavigator.tsx` | Add maintenance gate, force update gate, help requests feature gate |
| `app/screens/task-detail/hooks/useTaskDetailController.tsx` | Replace hardcoded `5000` with `getRemoteFlag("help_request_poll_interval_ms")` |
| `app/hooks/useForegroundLocation.ts` | Gate permission request behind `feature_location_capture_enabled` |
| `app/context/AuthContext.tsx` | Gate FCM registration behind `feature_push_registration_enabled` |
| `app/services/analytics.ts` | Gate dev collection behind `analytics_debug_logging_enabled`; log `remote_config_activated` event |
| `app/utils/crashReporting.ts` | Gate user context behind `crashlytics_user_context_enabled`; add RC attributes after activation |
| Home screen component | Add `getBannerConfig()` banner |
| Support/profile screen | Add `getSupportContactConfig()` contact links |
| `app/screens/MaintenanceScreen.tsx` | New screen |
| `app/screens/ForceUpdateScreen.tsx` | New screen |
