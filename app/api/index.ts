import { getRemoteFlag } from "@/services/remoteConfig"
import { OolshikApi as RealOolshikApi } from "./client"
import { MockOolshikApi } from "./mockClient"

// Two-layer safety: Remote Config flag must be true AND we must be in a dev build.
// A misconfigured production Console entry cannot route real users to mock data.
// Cast keeps the full RealOolshikApi interface visible to TypeScript — MockOolshikApi
// intentionally implements a subset, and the union type would break downstream callers.
export const OolshikApi = ((getRemoteFlag("mock_upload_create_enabled") && __DEV__)
  ? MockOolshikApi
  : RealOolshikApi) as typeof RealOolshikApi
export type { AuthMeResponse, PaymentProfileApiResponse, PaymentProfileEditApiResponse } from "./client"
