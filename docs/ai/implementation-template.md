Use the repo’s root agent instructions and shared AI docs as primary context:

- `AGENTS.md`
- `CLAUDE.md`
- `docs/ai/repo-map.md`
- `docs/ai/current-auth-state.md`

Use whichever root file is supported by the current tool.

Task:

- [one concrete implementation goal]

Scope files:

- [exact frontend files]
- [exact backend files under `../spring_boot_proj/oolshik-backend-otp/` only if contract changes require it]

Constraints:

- preserve backend-issued session handling
- preserve token refresh behavior unless the task explicitly changes it
- do not merge `auth.token` and `auth.accessToken` without verification
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

Output format:

1. Design and assumptions
2. Planned file changes
3. Code
4. Validation results
