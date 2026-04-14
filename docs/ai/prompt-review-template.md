Use the repo’s root agent instructions and shared AI docs as primary context:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ai/repo-map.md`
- `docs/ai/current-auth-state.md`

Use whichever root file is supported by the current tool.

Task: Review whether the attached implementation prompt is compatible with the current code.

Scope limit:

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
  - `app/services/phoneNumberHint.ts` only if the prompt changes Google phone capture or Android phone-hint behavior
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
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/repo/FederatedIdentityRepository.java` only if the prompt changes Google account linking or first-login user creation behavior
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/entity/FederatedIdentityEntity.java` only if the prompt changes Google identity persistence behavior
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/repo/OtpCodeRepository.java` only if the prompt changes OTP persistence, cooldown, or verification semantics
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/entity/OtpCodeEntity.java` only if the prompt changes OTP persistence, cooldown, or verification semantics
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/service/DevOtpProvider.java` only if the prompt changes dev OTP delivery behavior
  - `../spring_boot_proj/oolshik-backend-otp/src/main/java/com/oolshik/backend/service/Msg91OtpProvider.java` only if the prompt changes production OTP delivery behavior
- Expand scope only if a direct dependency requires it.
- Do not scan unrelated feed, payments, notifications, media, or infra code unless a direct dependency chain requires it.

Output only:

1. Compatible assumptions
2. Conflicting assumptions
3. Missing inputs
4. Files that must change
5. Whether implementation can proceed

Do not generate code.
