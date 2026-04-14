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
- Active login screen wiring lives in `app/screens/LoginScreen.tsx`.
- Google login is initiated with `expo-auth-session` from `app/screens/login/useLoginScreenController.ts`.
- Phone OTP is handled through backend API calls in `app/api/client.ts`.
- The current auth endpoints used by the app are:
  - `/auth/otp/request`
  - `/auth/otp/verify`
  - `/auth/google`
  - `/auth/complete`
  - `/auth/me`
  - `/auth/me/language`
  - `/auth/refresh`
- Transport tokens are persisted in `app/auth/tokens.ts`:
  - `auth.accessToken`
  - `auth.refreshToken`
- UI/session fields are separately persisted in `app/context/AuthContext.tsx`:
  - `auth.token`
  - `auth.email`
  - `auth.userId`
  - `auth.userName`
- During session finalization, the same backend access token is currently written to both `auth.token` and `auth.accessToken`.
- The current refresh contract is backend-JWT-based:
  - requests use `auth.accessToken`
  - refresh uses `auth.refreshToken`
  - `/auth/refresh` currently returns a new `accessToken`
  - the backend does not currently rotate the refresh token on refresh
- `/auth/me` is the current profile hydration source after session establishment.
- Feature flags currently include:
  - `AUTH_PHONE_OTP_ENABLED`
  - `AUTH_GOOGLE_ENABLED`
  - `AUTH_GOOGLE_REQUIRE_PHONE`
- Backend runtime auth flags currently include:
  - `app.auth.phone.otpEnabled`
  - `app.auth.google.enabled`
  - `app.auth.google.requirePhone`
  - `app.auth.google.autoLinkByEmail`
  - `app.auth.google.allowedClientIds`
  - `app.otp.*`
- Google sign-in may conditionally collect a phone hint from `app/services/phoneNumberHint.ts`.
- `app/services/firebase.ts` exists, but it is not the locally confirmed active login path.

## Warning

- Do not assume `auth.token` and `auth.accessToken` have identical responsibilities, even though they currently receive the same backend access token at login time.
- Do not assume the frontend contract is defined only by `AuthController`; it is also shaped by:
  - `AuthDtos`
  - `UserService`
  - `CurrentUserService`
  - `GoogleAuthService`
  - `OtpService`
  - `GlobalExceptionHandler`
- Before changing auth behavior, confirm:
  - which token is used for UI hydration and state
  - which token is attached to API requests
  - which token is refreshed
  - how those two storage locations are synchronized after login, app relaunch, and logout
  - whether the backend response shape or error shape changes the frontend login UX

## Architecture Rule

Do not infer active auth architecture from installed packages alone.
Prefer:
1. active screen/controller flow
2. API client calls and interceptors
3. token persistence and hydration
4. feature flags and runtime config
