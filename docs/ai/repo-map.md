# Frontend Repo Map

This file is compact by design. Use it for first-pass context, then inspect code only where needed.

## App Shape

- React Native / Expo app
- Main app code lives under `app/`
- `src/` is not the primary auth-flow location

## Auth Entry Points

- `app/screens/LoginScreen.tsx`
  - active login screen wiring
  - connects the controller to Google and phone OTP UI components

- `app/context/AuthContext.tsx`
  - UI auth state and logout reaction
  - persists `auth.token`, `auth.email`, `auth.userId`, `auth.userName`

- `app/screens/login/useLoginScreenController.ts`
  - main login orchestration
  - Google sign-in, phone OTP, profile completion, `/auth/me` hydration

- `app/api/client.ts`
  - auth endpoint calls
  - auth whitelist
  - bearer header attachment
  - refresh handling
  - `setLoginTokens(...)`

- `app/api/index.ts`
  - selects the active API implementation
  - re-exports shared auth response types

- `app/auth/tokens.ts`
  - transport-token persistence
  - stores `auth.accessToken` and `auth.refreshToken`

## Login UI Files

- `app/screens/login/GoogleLoginCard.tsx`
- `app/screens/login/PhoneOtpFlow.tsx`
- `app/screens/login/AuthModeToggle.tsx`

## Config Entry Points

- `app/config/config.base.ts`
- `app/config/config.dev.ts`
- `app/config/config.prod.ts`
- `app.config.ts`

## Auth-Adjacent Files

- `app/services/phoneNumberHint.ts`
  - Android phone hint capture used by the login flow when requested

- `app/services/firebase.ts`
  - present in the repo, but not the locally confirmed active auth entry path

## Baseline Auth Review Scope

Start with:
- `app/screens/LoginScreen.tsx`
- `app/context/AuthContext.tsx`
- `app/screens/login/useLoginScreenController.ts`
- `app/screens/login/GoogleLoginCard.tsx`
- `app/screens/login/PhoneOtpFlow.tsx`
- `app/screens/login/AuthModeToggle.tsx`
- `app/api/index.ts`
- `app/api/client.ts`
- `app/auth/tokens.ts`
- `app/config/config.base.ts`
- `app/config/config.dev.ts`
- `app/config/config.prod.ts`
- `app.config.ts`

If backend contract or session verification is required, inspect:
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/web/AuthController.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/web/dto/AuthDtos.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/web/GlobalExceptionHandler.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/security/SecurityConfig.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/security/JwtAuthFilter.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/security/JwtService.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/service/AuthService.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/service/CurrentUserService.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/service/UserService.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/service/GoogleAuthService.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/service/GoogleIdTokenVerifierService.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/service/OtpService.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/config/AuthProperties.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/config/OtpProperties.java`
- `../spring_boot_proj/oolshik-backend-otp/src/main/resources/application.yml`
- `../spring_boot_proj/oolshik-backend-otp/src/main/resources/application-dev.yml`
- `../spring_boot_proj/oolshik-backend-otp/src/main/resources/application-prod.yml`

Expand only if a direct dependency requires it.
