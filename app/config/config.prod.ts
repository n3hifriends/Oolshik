/**
 * These are configuration settings for the production environment.
 *
 * Do not include API secrets in this file or anywhere in your JS.
 *
 * https://reactnative.dev/docs/security#storing-sensitive-info
 */
export default {
  API_URL: "",
  LOCAL_AUDIO_PUBLIC_STREAM:
    (process.env.EXPO_PUBLIC_LOCAL_AUDIO_PUBLIC_STREAM || "false").toLowerCase() === "true",
}
