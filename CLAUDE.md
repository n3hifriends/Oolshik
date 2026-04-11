# Oolshik Frontend Claude Guide

Use `docs/ai/repo-map.md` and `docs/ai/current-auth-state.md` as primary context for auth-related work before widening scope.

## Working Rules

- Prefer the smallest relevant file set. Do not do full-repo scans unless the task requires it.
- For auth work, start in `app/`, not `src/`.
- Do not infer active architecture from installed packages alone.
- Prefer evidence in this order:
  1. active screen/controller flow
  2. API client calls and request interceptors
  3. token persistence and hydration
  4. feature flags and runtime config
- Start with medium effort. Increase only if the task is cross-cutting or inconsistent.
- For review-only tasks, do not generate code unless explicitly asked.

## Auth Focus

Treat these as the primary auth entry points:
- `app/context/AuthContext.tsx`
- `app/screens/login/useLoginScreenController.ts`
- `app/api/index.ts`
- `app/api/client.ts`
- `app/auth/tokens.ts`
- `app/config/config.base.ts`
- `app/config/config.dev.ts`
- `app/config/config.prod.ts`
- `app.config.ts`

## Cross-Repo Note

If auth work requires backend contract verification, inspect only the relevant files in the sibling backend repo at `../spring_boot_proj/oolshik-backend-otp`.

## Review Output Format

When asked for review only, respond with:
1. Compatible assumptions
2. Conflicting assumptions
3. Missing inputs
4. Files that must change
5. Whether implementation can proceed
