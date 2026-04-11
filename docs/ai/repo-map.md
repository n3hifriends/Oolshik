# Frontend Repo Map

This file is compact by design. Use it for first-pass context, then inspect code only where needed.

## App Shape

- React Native / Expo app
- Main app code lives under `app/`
- `src/` is not the primary auth-flow location

## Auth Entry Points

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

## Config Entry Points

- `app/config/config.base.ts`
- `app/config/config.dev.ts`
- `app/config/config.prod.ts`
- `app.config.ts`

## Auth-Adjacent Files

- `app/services/phoneNumberHint.ts`
- `app/services/firebase.ts`

## Baseline Auth Review Scope

Start with:
- `app/context/AuthContext.tsx`
- `app/screens/login/useLoginScreenController.ts`
- `app/api/index.ts`
- `app/api/client.ts`
- `app/auth/tokens.ts`
- `app/config/config.base.ts`
- `app/config/config.dev.ts`
- `app/config/config.prod.ts`
- `app.config.ts`

Expand only if a direct dependency requires it.
