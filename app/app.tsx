/* eslint-disable import/first */
/**
 * Welcome to the main entry point of the app. In this file, we'll
 * be kicking off our app.
 *
 * Most of this file is boilerplate and you shouldn't need to modify
 * it very often. But take some time to look through and understand
 * what is going on here.
 *
 * The app navigation resides in ./app/navigators, so head over there
 * if you're interested in adding screens and navigators.
 */
if (__DEV__) {
  // Load Reactotron in development only.
  // Note that you must be using metro's `inlineRequires` for this to work.
  // If you turn it off in metro.config.js, you'll have to manually import it.
  require("./devtools/ReactotronConfig.ts")
}
import "./utils/gestureHandler"

import { useEffect, useState } from "react"
import { useFonts } from "expo-font"
import * as Linking from "expo-linking"
import { KeyboardProvider } from "react-native-keyboard-controller"
import { initialWindowMetrics, SafeAreaProvider } from "react-native-safe-area-context"
import i18n from "i18next"

import { AuthProvider } from "./context/AuthContext" // @demo remove-current-line
import { AlertOverrideProvider } from "./components/AlertDialog/AlertOverrideProvider"
// runtime-detect portal provider so we don't hard-depend on it
let PortalProvider: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("react-native-portal")
  const candidate = mod?.PortalProvider ?? mod?.Provider ?? mod?.default ?? null
  const isLegacy = !!(candidate && (candidate as any).childContextTypes)
  PortalProvider = isLegacy ? null : candidate
} catch {
  PortalProvider = null
}

import { initI18n } from "./i18n"
import { AppNavigator } from "./navigators/AppNavigator"
import { useNavigationPersistence } from "./navigators/navigationUtilities"
import { ThemeProvider } from "./theme/context"
import { customFontsToLoad } from "./theme/typography"
import { loadDateFnsLocale } from "./utils/formatDate"
import * as storage from "./utils/storage"
import { getProfileExtras, updateProfileExtras } from "./features/profile/storage/profileExtrasStore"
import { useFeedbackQueue } from "./features/feedback/storage/feedbackQueue"
import { OolshikApi } from "./api"
import { tokens } from "./auth/tokens"
import { pickDeviceLocaleTag, resolvePreferredLocale, normalizeLocaleTag } from "./i18n/locale"

export const NAVIGATION_PERSISTENCE_KEY = "NAVIGATION_STATE"

// Web linking configuration
const prefix = Linking.createURL("/")
const config = {
  screens: {
    Login: {
      path: "",
    },
    Welcome: "welcome",
    Demo: {
      screens: {
        DemoShowroom: {
          path: "showroom/:queryIndex?/:itemIndex?",
        },
        DemoDebug: "debug",
        DemoPodcastList: "podcast",
        DemoCommunity: "community",
      },
    },
  },
}

/**
 * This is the root component of our app.
 * @param {AppProps} props - The props for the `App` component.
 * @returns {JSX.Element} The rendered `App` component.
 */
export function App() {
  useFeedbackQueue()
  const {
    initialNavigationState,
    onNavigationStateChange,
    isRestored: isNavigationStateRestored,
  } = useNavigationPersistence(storage, NAVIGATION_PERSISTENCE_KEY)

  const [areFontsLoaded, fontLoadError] = useFonts(customFontsToLoad)
  const [isI18nInitialized, setIsI18nInitialized] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const instance = await initI18n()
      let serverPreference: string | null = null
      let localPreference: string | null = null
      try {
        const extras = await getProfileExtras()
        localPreference = extras.preferredLanguage ?? extras.language ?? null
      } catch {
        // best-effort
      }
      try {
        if (tokens.access) {
          const me = await OolshikApi.me()
          if (me?.ok && me.data) {
            const profile = me.data
            serverPreference = profile.preferredLanguage ?? profile.locale ?? profile.languages ?? null
          }
        }
      } catch {
        // best-effort
      }

      const resolvedLocale = resolvePreferredLocale({
        serverPreference,
        localPreference,
        deviceLocaleTag: pickDeviceLocaleTag(),
      })
      await instance.changeLanguage(normalizeLocaleTag(resolvedLocale))

      try {
        if (!localPreference || normalizeLocaleTag(localPreference) !== resolvedLocale) {
          await updateProfileExtras({
            preferredLanguage: resolvedLocale,
            language: resolvedLocale,
          })
        }
      } catch {
        // best-effort
      }

      try {
        if (tokens.access && !serverPreference) {
          await OolshikApi.updatePreferredLanguage(resolvedLocale)
        }
      } catch {
        // best-effort
      }
      await loadDateFnsLocale()
      if (!mounted) return
      setIsI18nInitialized(true)
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    const onLanguageChanged = () => {
      loadDateFnsLocale()
    }
    i18n.on("languageChanged", onLanguageChanged)
    return () => {
      i18n.off("languageChanged", onLanguageChanged)
    }
  }, [])

  // Before we show the app, we have to wait for our state to be ready.
  // In the meantime, don't render anything. This will be the background
  // color set in native by rootView's background color.
  // In iOS: application:didFinishLaunchingWithOptions:
  // In Android: https://stackoverflow.com/a/45838109/204044
  // You can replace with your own loading component if you wish.
  if (!isNavigationStateRestored || !isI18nInitialized || (!areFontsLoaded && !fontLoadError)) {
    return null
  }

  const linking = {
    prefixes: [prefix],
    config,
  }

  // otherwise, we're ready to render the app
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <KeyboardProvider>
        {/* @demo remove-block-start */}
        <AuthProvider>
          {/* @demo remove-block-end */}
          <ThemeProvider>
            {PortalProvider && typeof PortalProvider === "function" ? (
              <PortalProvider>
                <AlertOverrideProvider>
                  <AppNavigator
                    linking={linking}
                    initialState={initialNavigationState}
                    onStateChange={onNavigationStateChange}
                  />
                </AlertOverrideProvider>
              </PortalProvider>
            ) : (
              <AlertOverrideProvider>
                <AppNavigator
                  linking={linking}
                  initialState={initialNavigationState}
                  onStateChange={onNavigationStateChange}
                />
              </AlertOverrideProvider>
            )}
          </ThemeProvider>
          {/* @demo remove-block-start */}
        </AuthProvider>
        {/* @demo remove-block-end */}
      </KeyboardProvider>
    </SafeAreaProvider>
  )
}
