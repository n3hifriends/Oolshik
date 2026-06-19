/**
 * These are configuration settings for the dev environment.
 *
 * Do not include API secrets in this file or anywhere in your JS.
 *
 * https://reactnative.dev/docs/security#storing-sensitive-info
 */
export default {
  API_URL: process.env.EXPO_PUBLIC_API_URL || "https://www.oolshik.in",
  AUTH_PHONE_OTP_ENABLED:
    (process.env.EXPO_PUBLIC_AUTH_PHONE_OTP_ENABLED || "false").toLowerCase() === "true",
  AUTH_GOOGLE_ENABLED:
    (process.env.EXPO_PUBLIC_AUTH_GOOGLE_ENABLED || "true").toLowerCase() === "true",
  AUTH_GOOGLE_REQUIRE_PHONE:
    (process.env.EXPO_PUBLIC_AUTH_GOOGLE_REQUIRE_PHONE || "true").toLowerCase() === "true",
  REQUIRE_PRESIGNED_AUDIO_UPLOAD:
    (process.env.EXPO_PUBLIC_REQUIRE_PRESIGNED_AUDIO_UPLOAD || "false").toLowerCase() === "true",
  GOOGLE_WEB_CLIENT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    "263296903071-l80n6ccefcn05s5apnobtlpl1cc0fd5t.apps.googleusercontent.com",
  GOOGLE_ANDROID_CLIENT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID ||
    "263296903071-v73slipdgnp9ffj4vlnav47usqpf4l3t.apps.googleusercontent.com",
  GOOGLE_IOS_CLIENT_ID:
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    "263296903071-e6t5p5s4on6naqbkpieo1enrudr2d6ch.apps.googleusercontent.com",
  LOCAL_AUDIO_PUBLIC_STREAM:
    (process.env.EXPO_PUBLIC_LOCAL_AUDIO_PUBLIC_STREAM || "true").toLowerCase() === "true",
}
