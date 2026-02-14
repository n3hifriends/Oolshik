import { I18nManager } from "react-native"
import * as Localization from "expo-localization"
import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import "intl-pluralrules"

// if English isn't your default language, move Translations to the appropriate language file.
import ar from "./ar"
import en, { Translations } from "./en"
import es from "./es"
import fr from "./fr"
import hi from "./hi"
import ja from "./ja"
import ko from "./ko"
import mr from "./mr"
import { FALLBACK_LOCALE, normalizeLocaleTag, pickDeviceLocaleTag } from "./locale"

const fallbackLocale = FALLBACK_LOCALE

const resources = {
  "en-IN": en,
  en,
  "mr-IN": mr,
  mr,
  ar,
  ko,
  es,
  fr,
  ja,
  hi,
}

const deviceLocaleTag = pickDeviceLocaleTag(Localization.getLocales())
const locale = deviceLocaleTag
  ? Localization.getLocales().find((item) => normalizeLocaleTag(item.languageTag) === deviceLocaleTag)
  : undefined

export let isRTL = false

// Need to set RTL ASAP to ensure the app is rendered correctly. Waiting for i18n to init is too late.
if (locale?.languageTag && locale?.textDirection === "rtl") {
  I18nManager.allowRTL(true)
  isRTL = true
} else {
  I18nManager.allowRTL(false)
}

export const initI18n = async () => {
  i18n.use(initReactI18next)

  await i18n.init({
    resources,
    lng: deviceLocaleTag ?? fallbackLocale,
    fallbackLng: fallbackLocale,
    interpolation: {
      escapeValue: false,
    },
  })

  return i18n
}

/**
 * Builds up valid keypaths for translations.
 */

export type TxKeyPath = RecursiveKeyOf<Translations>

// via: https://stackoverflow.com/a/65333050
type RecursiveKeyOf<TObj extends object> = {
  [TKey in keyof TObj & (string | number)]: RecursiveKeyOfHandleValue<TObj[TKey], `${TKey}`, true>
}[keyof TObj & (string | number)]

type RecursiveKeyOfInner<TObj extends object> = {
  [TKey in keyof TObj & (string | number)]: RecursiveKeyOfHandleValue<TObj[TKey], `${TKey}`, false>
}[keyof TObj & (string | number)]

type RecursiveKeyOfHandleValue<
  TValue,
  Text extends string,
  IsFirstLevel extends boolean,
> = TValue extends any[]
  ? Text
  : TValue extends object
    ? IsFirstLevel extends true
      ? Text | `${Text}:${RecursiveKeyOfInner<TValue>}`
      : Text | `${Text}.${RecursiveKeyOfInner<TValue>}`
    : Text
