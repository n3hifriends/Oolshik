export interface ConfigBaseProps {
  persistNavigation: "always" | "dev" | "prod" | "never"
  catchErrors: "always" | "dev" | "prod" | "never"
  exitRoutes: string[]
  AUTH_PHONE_OTP_ENABLED: boolean
  AUTH_GOOGLE_ENABLED: boolean
  AUTH_GOOGLE_REQUIRE_PHONE: boolean
  REQUIRE_PRESIGNED_AUDIO_UPLOAD: boolean
}

export type PersistNavigationConfig = ConfigBaseProps["persistNavigation"]

const BaseConfig: ConfigBaseProps = {
  // This feature is particularly useful in development mode, but
  // can be used in production as well if you prefer.
  persistNavigation: "dev",

  /**
   * Only enable if we're catching errors in the right environment
   */
  catchErrors: "always",

  /**
   * This is a list of all the route names that will exit the app if the back button
   * is pressed while in that screen. Only affects Android.
   */
  exitRoutes: ["Welcome"],
  AUTH_PHONE_OTP_ENABLED: false,
  AUTH_GOOGLE_ENABLED: true,
  AUTH_GOOGLE_REQUIRE_PHONE: true,
  REQUIRE_PRESIGNED_AUDIO_UPLOAD: false,
}

export default BaseConfig
