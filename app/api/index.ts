import { FLAGS } from "@/config/flags"
import { OolshikApi as RealOolshikApi } from "./client"
import { MockOolshikApi } from "./mockClient"

// export const OolshikApi = FLAGS.USE_MOCK_UPLOAD_CREATE ? MockOolshikApi : RealOolshikApi
export const OolshikApi = RealOolshikApi
