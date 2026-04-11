# Current Frontend Auth State

Update this file whenever any of these change:
- login method
- bearer token source
- refresh behavior
- auth storage keys
- feature flags affecting auth
- onboarding requirements for phone, email, or Google

## Locally Confirmed Current State

- Active login flow is backend-session-oriented.
- Google login is initiated with `expo-auth-session` from `app/screens/login/useLoginScreenController.ts`.
- Phone OTP is handled through backend API calls in `app/api/client.ts`.
- Transport tokens are persisted in `app/auth/tokens.ts`:
  - `auth.accessToken`
  - `auth.refreshToken`
- UI/session fields are separately persisted in `app/context/AuthContext.tsx`:
  - `auth.token`
  - `auth.email`
  - `auth.userId`
  - `auth.userName`
- During session finalization, the same backend access token is currently written to both `auth.token` and `auth.accessToken`.
- Feature flags currently include:
  - `AUTH_PHONE_OTP_ENABLED`
  - `AUTH_GOOGLE_ENABLED`
  - `AUTH_GOOGLE_REQUIRE_PHONE`
- `app/services/firebase.ts` exists, but it is not the locally confirmed active login path.

## Warning

- Do not assume `auth.token` and `auth.accessToken` have identical responsibilities, even though they currently receive the same backend access token at login time.
- Before changing auth behavior, confirm:
  - which token is used for UI hydration and state
  - which token is attached to API requests
  - which token is refreshed
  - how those two storage locations are synchronized after login, app relaunch, and logout

## Architecture Rule

Do not infer active auth architecture from installed packages alone.
Prefer:
1. active screen/controller flow
2. API client calls and interceptors
3. token persistence and hydration
4. feature flags and runtime config
