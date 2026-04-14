Use the repo’s root agent instructions and shared AI docs as primary context:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ai/repo-map.md`
- `docs/ai/current-auth-state.md`

Use whichever root file is supported by the current tool.

Task:

- [one concrete implementation goal]

Scope files:

- Frontend core:
  - `app/screens/LoginScreen.tsx`
  - `app/screens/login/useLoginScreenController.ts`
  - `app/screens/login/GoogleLoginCard.tsx`
  - `app/screens/login/PhoneOtpFlow.tsx`
  - `app/screens/login/AuthModeToggle.tsx`
  - `app/context/AuthContext.tsx`
  - `app/api/index.ts`
  - `app/api/client.ts`
  - `app/auth/tokens.ts`
  - `app/config/config.base.ts`
  - `app/config/config.dev.ts`
  - `app/config/config.prod.ts`
  - `app.config.ts`
- Frontend conditional:
  - `app/services/phoneNumberHint.ts` only if the task changes Google phone capture or Android phone-hint behavior
- Backend core:
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
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/repo/UserRepository.java`
  - `../spring_boot_proj/oolshik-backend-otp/src/main/resources/application.yml`
  - `../spring_boot_proj/oolshik-backend-otp/src/main/resources/application-dev.yml`
  - `../spring_boot_proj/oolshik-backend-otp/src/main/resources/application-prod.yml`
- Backend conditional:
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/repo/FederatedIdentityRepository.java` only if the task changes Google account linking or first-login user creation behavior
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/entity/FederatedIdentityEntity.java` only if the task changes Google identity persistence behavior
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/repo/OtpCodeRepository.java` only if the task changes OTP persistence, cooldown, or verification semantics
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/entity/OtpCodeEntity.java` only if the task changes OTP persistence, cooldown, or verification semantics
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/service/DevOtpProvider.java` only if the task changes dev OTP delivery behavior
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/service/Msg91OtpProvider.java` only if the task changes production OTP delivery behavior
- Expand beyond these files only when a direct dependency requires it.

Constraints:

- preserve backend-issued session handling
- preserve token refresh behavior unless the task explicitly changes it
- preserve the current refresh contract where `/auth/refresh` returns a new access token and does not rotate the refresh token unless the task explicitly changes backend and frontend together
- do not merge `auth.token` and `auth.accessToken` without verification
- preserve `AuthController` and `AuthDtos` request/response shapes unless the task explicitly changes the frontend and backend contract together
- do not infer active auth from package presence alone

Acceptance criteria:

- [observable outcomes]
- [non-functional requirements]

Do not break:

- login flow selection
- OTP request and verify flow
- Google sign-in flow
- `/auth/me` profile hydration
- bearer token attachment and refresh

Validation commands:

- `npm run compile`
- relevant focused tests only if the touched area has them
- if backend files change, run only focused backend tests in `../spring_boot_proj/oolshik-backend-otp`

Output format:

1. Design and assumptions
2. Planned file changes
3. Code
4. Validation results
