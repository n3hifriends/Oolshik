# Crashlytics Keys and Breadcrumbs Implementation Plan

**App:** Oolshik mobile app  
**Scope:** React Native / Expo mobile app only  
**Goal:** Make Firebase Crashlytics events actionable by adding a consistent set of custom keys and high-signal breadcrumb logs without exposing sensitive user data.

---

## 1. Current State

The mobile app already has the correct foundation:

- `@react-native-firebase/crashlytics` is installed.
- Crashlytics is initialized early in `app/app.tsx`.
- `app/utils/crashReporting.ts` already wraps:
  - collection enablement
  - fatal/non-fatal reporting
  - user id attachment
  - custom logs
  - custom attributes
  - Remote Config attributes
- `AuthContext.tsx` already syncs authenticated user id to Crashlytics.
- `navigationUtilities.ts` already logs screen breadcrumbs.
- `remoteConfig.ts` already supports `crashlytics_user_context_enabled`.

The missing piece is not setup. The missing piece is a disciplined observability contract: which keys are set, where they are updated, what breadcrumbs are allowed, and what must never be logged.

---

## 2. Design Principles

1. **Use keys for durable state.**  
   Keys should describe the latest known app/session/user/request state at crash time.

2. **Use logs for timeline.**  
   Breadcrumbs should explain the sequence of user actions and app events before the crash.

3. **Never log raw sensitive data.**  
   Do not log phone numbers, emails, names, JWTs, OTPs, exact coordinates, full addresses, UPI IDs, payment references, request descriptions, report text, audio/transcript content, or backend response bodies.

4. **Prefer stable categories over unique values.**  
   Good: `network_status=offline`, `payment_mode=qr_scan`.  
   Bad: raw URLs, full IDs, user-entered text.

5. **Keep the key set small and intentional.**  
   Firebase Crashlytics keys are most useful when they are consistent across events and easy to filter in the console.

6. **Remote Config controls privacy, not correctness.**  
   `crashlytics_user_context_enabled` can disable user context. It must not control application behavior or security decisions.

---

## 3. Proposed Crashlytics Utility Contract

Extend `app/utils/crashReporting.ts` as the only public Crashlytics entry point.

### Keep Existing Functions

- `initCrashReporting`
- `reportCrash`
- `setUserId`
- `clearUserId`
- `log`
- `setAttribute`
- `setRemoteConfigAttributes`

### Add Higher-Level Helpers

Add named helpers so screens and services do not invent ad hoc keys:

- `setSessionContext`
- `setAuthContext`
- `setUserRoleContext`
- `setLocationContext`
- `setRequestContext`
- `clearRequestContext`
- `setPaymentContext`
- `clearPaymentContext`
- `setApiFailureContext`
- `clearApiFailureContext`
- `breadcrumb`
- `recordHandledError`

The helper names are intentionally domain-oriented. Callers should not know Firebase key names directly.

### Gating Rules for Helpers

Not all helpers should be gated by `crashlytics_user_context_enabled`. The existing `setAttribute` gates everything behind it, which is too broad.

**Always set (no RC gate):**
- `setSessionContext` — `app_foreground_state`, `screen_current`, `screen_previous` are device state, not PII
- `setApiFailureContext` / `clearApiFailureContext` — HTTP status, method, domain, error kind are not PII
- `setLocationContext` — only permission status and accuracy/age buckets, no coordinates
- `breadcrumb` — gated by `crashlytics_breadcrumbs_enabled` only (see section 8)

**Gated by `crashlytics_user_context_enabled`:**
- `setAuthContext` — `auth_has_token`, `auth_step_last`, `auth_method_last` are session-linked
- `setUserRoleContext` — role is tied to a specific authenticated user
- `setRequestContext` / `clearRequestContext` — task context is tied to an authenticated user's activity

**Gated by `crashlytics_payment_context_enabled`:**
- `setPaymentContext` / `clearPaymentContext`

**Gated by `crashlytics_location_context_enabled`:**
- Location keys within `setLocationContext`

**`recordHandledError`** is a wrapper around the existing `reportCrash(error, ErrorType.HANDLED)` that additionally calls `setApiFailureContext` with the error's normalized fields before recording. It does not replace `reportCrash` — callers that already use `reportCrash` with `ErrorType.HANDLED` should migrate to `recordHandledError` only when they also want to attach context keys.

---

## 4. Custom Key Registry

Use lowercase snake_case keys.

### App / Build Keys

These keys are **not gated** by any RC flag. They are device/build facts with no PII. Set them once at app startup via `sdkSetAttributes` directly (not through the gated `setAttribute` helper).

| Key | Example | Source | Notes |
|---|---:|---|---|
| `app_env` | `prod` | `Config` | `dev`, `staging`, `prod` |
| `app_version` | `1.0.0` | native/app config | Keep string |
| `build_number` | `1` | native/app config | Android versionCode / iOS build |
| `platform` | `android` | React Native `Platform` | `android` or `ios` |
| `device_class` | `phone` | device info | Avoid raw device name if not needed |
| `locale` | `en-IN` | i18n locale | No user-entered language text |

### Session Keys

| Key | Example | Source | Notes |
|---|---:|---|---|
| `session_auth_state` | `authenticated` | `AuthContext` | `anonymous`, `authenticated` |
| `session_role` | `neta` | profile/auth state | `neta`, `karyakarta`, `unknown` |
| `screen_current` | `TaskDetail` | navigation | Updated on route change |
| `screen_previous` | `HomeFeed` | navigation | Useful for reproduction |
| `app_foreground_state` | `active` | AppState | `active`, `background`, `inactive` |

### Remote Config Keys

Existing `setRemoteConfigAttributes` should remain, but make the values consistent:

| Key | Example |
|---|---:|
| `rc_fetch_status` | `activated` |
| `rc_maintenance_mode` | `false` |
| `rc_force_update` | `false` |
| `rc_feature_flags` | `help_requests,audio_upload,location,push` |

### Auth Keys

Gated by `crashlytics_user_context_enabled` because these keys are session-linked. `auth_error_kind_last` is technically not PII, but it is set in the same call as the other auth keys so it follows the same gate for simplicity.

| Key | Example | Notes |
|---|---:|---|
| `auth_method_last` | `google` | `google`, `otp`, `unknown` |
| `auth_step_last` | `profile_loaded` | Last non-sensitive auth stage |
| `auth_error_kind_last` | `token_expired` | Normalized category only |
| `auth_has_token` | `true` | Boolean string |

Do not log OTP, email, phone, Firebase UID, JWT, or backend auth response body.

### Location Keys

| Key | Example | Notes |
|---|---:|---|
| `location_permission` | `granted` | `granted`, `denied`, `blocked`, `unknown` |
| `location_provider` | `gps` | If available |
| `location_accuracy_bucket` | `medium` | `high`, `medium`, `low`, `unknown` |
| `location_age_bucket` | `fresh` | `fresh`, `stale`, `missing` |

Do not log latitude, longitude, address, locality, or place names.

### Help Request / Task Keys

| Key | Example | Notes |
|---|---:|---|
| `task_context` | `detail` | `create`, `feed`, `detail`, `active`, `unknown` |
| `task_status` | `open` | Normalized backend status |
| `task_role` | `requester` | `requester`, `helper`, `viewer` |
| `task_id_short` | `c4ccd78` | First 6-8 chars only, optional |
| `task_has_audio` | `true` | Boolean string |
| `task_has_payment` | `true` | Boolean string |

Avoid task title, task description, transcript, user names, exact address, or full id.

### Payment Keys

Gated by `crashlytics_payment_context_enabled`.

| Key | Example | Notes |
|---|---:|---|
| `payment_context` | `task_detail` | Where payment action happened |
| `payment_mode` | `qr_scan` | `qr_scan`, `pay_helper`, `pay_requester` |
| `payment_status` | `initiated` | Normalized backend status |
| `payment_amount_bucket` | `100_499` | Bucketed amount — see scheme below |
| `payment_flow` | `neta_to_karyakarta` | No names or UPI |

**Amount bucket scheme (INR):**

| Bucket value | Range |
|---|---|
| `lt_100` | < ₹100 |
| `100_499` | ₹100 – ₹499 |
| `500_999` | ₹500 – ₹999 |
| `1000_4999` | ₹1,000 – ₹4,999 |
| `5000_plus` | ₹5,000+ |
| `unknown` | Amount not available at time of logging |

Do not log UPI ID, payment reference, payer/payee name, QR payload, or exact amount unless explicitly approved later.

### API Failure Keys

Not gated by `crashlytics_user_context_enabled`. HTTP status, method, domain, and error kind are operational data, not PII.

| Key | Example | Notes |
|---|---:|---|
| `api_last_domain` | `payments` | Domain, not full URL — see mapping below |
| `api_last_method` | `POST` | Method only |
| `api_last_status` | `403` | HTTP status |
| `api_last_error_kind` | `auth_forbidden` | From normalized API error |
| `api_last_retryable` | `false` | Boolean string |
| `api_last_duration_bucket` | `1s_3s` | Bucketed duration — see scheme below |

**URL-to-domain mapping:**

Map URL path prefixes to these domain labels. Any URL that does not match a known prefix must fall back to `unknown` — never log the raw URL.

| Domain label | URL path prefix match |
|---|---|
| `auth` | `/auth/`, `/otp/`, `/token/` |
| `tasks` | `/tasks/`, `/help-requests/` |
| `payments` | `/payments/` |
| `profile` | `/profile/`, `/users/` |
| `notifications` | `/notifications/`, `/push/` |
| `reports` | `/reports/` |
| `upload` | `/upload/`, `/presigned/` |
| `unknown` | anything else |

**Duration bucket scheme:**

| Bucket value | Range |
|---|---|
| `lt_500ms` | < 500 ms |
| `500ms_1s` | 500 ms – 1 s |
| `1s_3s` | 1 s – 3 s |
| `3s_10s` | 3 s – 10 s |
| `10s_plus` | > 10 s |
| `unknown` | Duration not measurable |

Do not log request/response body, Authorization header, OTP, upload payload, or full query strings.

---

## 5. Breadcrumb Taxonomy

Use a consistent format:

`domain:event key=value key=value`

Keep each breadcrumb short. Prefer categories and short ids only.

The `breadcrumb` helper must check `crashlytics_breadcrumbs_enabled` before writing. If the flag is false, the call is a no-op. This is independent of `crashlytics_user_context_enabled`.

### Navigation Breadcrumbs

Already partially implemented via `crashLog("screen:<route>")`.

Improve to:

| Event | Example |
|---|---|
| screen viewed | `nav:screen current=TaskDetail previous=HomeFeed` |
| deep link opened | `nav:deep_link target=TaskDetail has_task=true` |
| notification route | `nav:notification_open target=TaskDetail has_payment=true` |

### Auth Breadcrumbs

| Event | Example |
|---|---|
| login started | `auth:login_started method=google` |
| login success | `auth:login_success method=google` |
| login failed | `auth:login_failed method=otp error=rate_limited` |
| logout | `auth:logout` |
| token refresh failed | `auth:token_refresh_failed status=401` |

### API Breadcrumbs

Only log important API failures and major workflow calls, not every request.

| Event | Example |
|---|---|
| request started | `api:start domain=payments method=POST` |
| request failed | `api:failed domain=payments status=500 kind=server_error` |
| retry scheduled | `api:retry domain=push attempt=2` |

### Help Request Breadcrumbs

| Event | Example |
|---|---|
| create started | `task:create_started has_audio=true` |
| create success | `task:create_success id=c4ccd78` |
| accept started | `task:accept_started id=c4ccd78` |
| complete started | `task:complete_started id=c4ccd78` |
| report submitted | `task:report_submitted reason=unsafe` |

### Location Breadcrumbs

| Event | Example |
|---|---|
| permission requested | `location:permission_requested` |
| permission result | `location:permission_result status=denied` |
| refresh failed | `location:refresh_failed kind=timeout` |
| heartbeat failed | `location:heartbeat_failed status=503` |

### Audio Breadcrumbs

| Event | Example |
|---|---|
| recording started | `audio:recording_started` |
| recording stopped | `audio:recording_stopped duration_bucket=30s_60s` |
| upload started | `audio:upload_started size_bucket=1mb_5mb` |
| upload failed | `audio:upload_failed kind=network` |

Do not log transcript or raw audio metadata that can identify user content.

### Payment Breadcrumbs

| Event | Example |
|---|---|
| profile add started | `payment_profile:add_started method=manual` |
| QR parsed | `payment_profile:qr_parsed format=upi_uri` |
| payment initiated | `payment:initiated mode=qr_scan flow=neta_to_karyakarta` |
| payment marked paid | `payment:marked_paid mode=pay_helper` |
| payment failed | `payment:failed status=500 kind=server_error` |

---

## 6. Instrumentation Points

### Phase 1: Core Observability Wrapper

Files:

- `app/utils/crashReporting.ts`
- `app/services/remoteConfig.ts`
- `app/context/AuthContext.tsx`
- `app/navigators/navigationUtilities.ts`

Tasks:

- Add a typed key registry inside `crashReporting.ts`.
- Add helper functions listed in section 3, respecting the gating rules defined there.
- Add a one-time `setAppBuildContext` call (not gated) for app/build keys. Call it from `app/app.tsx` after `initCrashReporting`.
- Make `log` unexported (module-internal) and expose `breadcrumb` as the public API. `breadcrumb` checks `crashlytics_breadcrumbs_enabled` before writing.
- **Update `app/navigators/navigationUtilities.ts` in the same phase**: change `import { log as crashLog }` to `import { breadcrumb }` and update the call site. This must happen alongside making `log` unexported or the build breaks.
- Normalize breadcrumb format to `domain:event key=value`.
- Update navigation logging to also call `setAttribute` for `screen_current` and `screen_previous` (ungated — these are not PII).
- Keep `crashlytics_user_context_enabled` as the privacy gate for user id and user/auth/session-role keys only.

### Phase 2: Auth and Session Context

**Prerequisite:** Confirm the source of `session_role` before starting. The value (`neta`, `karyakarta`, `unknown`) must come from a stable location — likely `profileExtrasStore` or the profile API response loaded after login. The exact field and when it is first available must be identified; do not read it before hydration is complete.

Files:

- `app/context/AuthContext.tsx`
- `app/screens/login/useLoginScreenController.ts`
- `app/api/client.ts`

Tasks:

- Set `session_auth_state`, `auth_has_token`, and `session_role` after auth hydration. All three are gated by `crashlytics_user_context_enabled`.
- Breadcrumb login start/success/failure.
- On logout, clear user id and reset auth/session keys to `anonymous` / `false` / `unknown` sentinel values (do not delete keys — use reset values so the key still appears in the Firebase Console).
- On auth API failures, set normalized `auth_error_kind_last`.

### Phase 3: API Error Context

File:

- `app/api/client.ts`

Tasks:

- Add Crashlytics context only after normalized API errors.
- Map URLs to domains using the prefix table defined in section 4 (API Failure Keys). Any unmatched URL must produce `unknown` — never pass the raw URL to any key or breadcrumb.
- Record status, method, retryability, duration bucket (use the scheme in section 4), and error kind.
- API failure keys are not gated by `crashlytics_user_context_enabled`. Call `sdkSetAttribute` directly.
- Never send full URL, headers, request body, response body, or query string.

### Phase 4: High-Value Product Flows

Files:

- `app/screens/home-feed/hooks/useHomeFeedController.tsx`
- `app/screens/task-detail/hooks/useTaskDetailController.tsx`
- `app/screens/ReportScreen.tsx`
- `app/screens/PaymentProfileScreen.tsx`
- `app/utils/pushNotifications.ts`
- `app/hooks/useForegroundLocation.ts`
- audio recording/upload helpers

Tasks:

- Add task context when opening task detail. Call `clearRequestContext` on unmount of the task detail screen (not on success only — also on back navigation and error).
- Add report breadcrumbs for submit start/success/failure.
- Add payment breadcrumbs for profile setup, payment initiation, and mark-paid flows. Call `clearPaymentContext` when leaving the payment flow in all cases: success, cancellation, and error. Do not defer clearing to the next payment initiation.
- Add push notification breadcrumbs for receive/open/routing failure.
- Add location breadcrumbs for permission and refresh failures.
- Add audio breadcrumbs for recording/upload failures.
- Clear `api_last_*` keys after a successful API response in the same domain so stale failure context does not appear in unrelated crashes. Call `clearApiFailureContext` in the success path of any API call that also sets failure context.

### Phase 5: Verification and Operations

Tasks:

- Add a dev-only crash test action behind the existing dev/debug screen (identify and confirm this screen before starting — do not create a new screen). The action must not be reachable in production builds (`__DEV__` guard or `app_env !== 'prod'` check).
- Add one handled-error test path using `recordHandledError` to verify non-fatal reporting with context keys attached.
- Verify in Firebase Console:
  - `Keys` tab shows expected app/session/remote-config/task/payment keys.
  - `Logs & Breadcrumbs` shows clean ordered breadcrumbs.
  - No PII appears in keys or logs.
  - Android release builds upload readable symbols.
  - iOS release builds upload dSYMs.

---

## 7. Privacy Rules

### Allowed

- Short internal ids, max 6-8 chars
- Boolean feature states
- Status enums
- Role/category names
- Screen names
- HTTP status codes
- Error categories
- Bucketed amounts, durations, sizes, and accuracy

### Forbidden

- Phone number
- Email
- Person name
- JWT or refresh token
- OTP
- Firebase UID
- Full backend user id
- Full task/payment/report id
- Exact latitude/longitude
- Address or locality
- UPI ID
- UPI QR payload
- Payment reference
- Task description
- Report description
- Audio transcript
- Raw request or response body
- Authorization headers

---

## 8. Remote Config Additions

Existing:

- `crashlytics_user_context_enabled`

Recommended additions:

| Key | Type | Default | Purpose |
|---|---|---:|---|
| `crashlytics_breadcrumbs_enabled` | boolean | `true` | Emergency disable for breadcrumb volume |
| `crashlytics_api_error_context_enabled` | boolean | `true` | Disable API context if needed |
| `crashlytics_payment_context_enabled` | boolean | `true` | Separate payment privacy control |
| `crashlytics_location_context_enabled` | boolean | `true` | Separate location privacy control |

These flags should only control Crashlytics metadata. They must not affect app behavior.

### Required Changes to `app/services/remoteConfig.ts`

All four new flags must be added explicitly to:

1. The `RemoteConfigFlags` interface.
2. The `DEFAULTS` object (all default to `true`).

Without these additions, `getRemoteFlag()` will not know the expected type and will fall back incorrectly. This is a required Phase 1 task, not optional.

---

## 9. Acceptance Criteria

Implementation is complete when:

- Crashlytics keys are only set through `app/utils/crashReporting.ts`.
- No screen directly imports Firebase Crashlytics SDK.
- Navigation breadcrumbs include current and previous screen.
- Auth, API failure, task, report, location, audio, push, and payment flows have high-signal breadcrumbs.
- User logout clears user id and sensitive context keys.
- Payment and location context use buckets/categories only.
- A manual test crash in a release/internal build shows useful keys and breadcrumbs in Firebase Console.
- A manual non-fatal error appears with the same context.
- A privacy audit confirms no forbidden data appears in Firebase Console.

---

## 10. Suggested Execution Order

1. Confirm `session_role` source (which store/field, when available after login).
2. Confirm which screen hosts the dev/debug crash-test action.
3. Add new RC flags to `RemoteConfigFlags` interface and `DEFAULTS` in `remoteConfig.ts`.
4. Update the Crashlytics wrapper contract (`crashReporting.ts`): typed key registry, helpers with correct gating, `breadcrumb` (replaces public `log`), `recordHandledError`.
5. **In the same step**: update `navigationUtilities.ts` to import `breadcrumb` instead of `log as crashLog` (required because `log` is now unexported).
6. Add app/build keys via ungated `setAppBuildContext` in `app/app.tsx`.
7. Add session/navigation keys (ungated screen keys, gated role/auth-state).
8. Add auth and logout context handling.
9. Add API failure context in `client.ts` using the domain mapping table.
10. Add task/report/payment/location/audio/push breadcrumbs with correct clear-context lifecycle.
11. Add dev-only crash-test and handled-error test actions.
12. Run local typecheck and lint.
13. Build Android internal release and verify in Firebase Console.
14. Build iOS TestFlight/internal release and verify dSYMs.
15. Perform privacy review before production rollout.

---

## 11. Source References

- Firebase Crashlytics customize crash reports: https://firebase.google.com/docs/crashlytics/customize-crash-reports
- React Native Firebase Crashlytics usage: https://rnfirebase.io/crashlytics/usage
