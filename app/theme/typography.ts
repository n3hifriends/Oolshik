// TODO: write documentation about fonts and typography along with guides on how to add custom fonts in own
// markdown file and add links from here

import { Platform } from "react-native"
import {
  NotoSansDevanagari_300Light as notoSansDevanagariLight,
  NotoSansDevanagari_400Regular as notoSansDevanagariRegular,
  NotoSansDevanagari_500Medium as notoSansDevanagariMedium,
  NotoSansDevanagari_600SemiBold as notoSansDevanagariSemiBold,
  NotoSansDevanagari_700Bold as notoSansDevanagariBold,
} from "@expo-google-fonts/noto-sans-devanagari"
import {
  SpaceGrotesk_300Light as spaceGroteskLight,
  SpaceGrotesk_400Regular as spaceGroteskRegular,
  SpaceGrotesk_500Medium as spaceGroteskMedium,
  SpaceGrotesk_600SemiBold as spaceGroteskSemiBold,
  SpaceGrotesk_700Bold as spaceGroteskBold,
} from "@expo-google-fonts/space-grotesk"

export const customFontsToLoad = {
  spaceGroteskLight,
  spaceGroteskRegular,
  spaceGroteskMedium,
  spaceGroteskSemiBold,
  spaceGroteskBold,
  notoSansDevanagariLight,
  notoSansDevanagariRegular,
  notoSansDevanagariMedium,
  notoSansDevanagariSemiBold,
  notoSansDevanagariBold,
}

const fonts = {
  spaceGrotesk: {
    // Cross-platform Google font.
    light: "spaceGroteskLight",
    normal: "spaceGroteskRegular",
    medium: "spaceGroteskMedium",
    semiBold: "spaceGroteskSemiBold",
    bold: "spaceGroteskBold",
  },
  notoSansDevanagari: {
    // Space Grotesk has no Devanagari glyphs, so Marathi/Hindi text needs a
    // script-appropriate font — otherwise Android silently drops the glyphs.
    light: "notoSansDevanagariLight",
    normal: "notoSansDevanagariRegular",
    medium: "notoSansDevanagariMedium",
    semiBold: "notoSansDevanagariSemiBold",
    bold: "notoSansDevanagariBold",
  },
  helveticaNeue: {
    // iOS only font.
    thin: "HelveticaNeue-Thin",
    light: "HelveticaNeue-Light",
    normal: "Helvetica Neue",
    medium: "HelveticaNeue-Medium",
  },
  courier: {
    // iOS only font.
    normal: "Courier",
  },
  sansSerif: {
    // Android only font.
    thin: "sans-serif-thin",
    light: "sans-serif-light",
    normal: "sans-serif",
    medium: "sans-serif-medium",
  },
  monospace: {
    // Android only font.
    normal: "monospace",
  },
}

export const typography = {
  /**
   * The fonts are available to use, but prefer using the semantic name.
   */
  fonts,
  /**
   * The primary font. Used in most places.
   */
  primary: fonts.spaceGrotesk,
  /**
   * An alternate font used for perhaps titles and stuff.
   */
  secondary: Platform.select({ ios: fonts.helveticaNeue, android: fonts.sansSerif }),
  /**
   * Lets get fancy with a monospace font!
   */
  code: Platform.select({ ios: fonts.courier, android: fonts.monospace }),
}

/**
 * Picks the primary font family for the given i18n language code.
 * Devanagari-script locales (mr, hi) need `notoSansDevanagari` since
 * `spaceGrotesk` has no Devanagari glyphs.
 */
export function primaryFontFor(languageCode?: string | null): typeof fonts.spaceGrotesk {
  return languageCode?.toLowerCase().startsWith("mr") ||
    languageCode?.toLowerCase().startsWith("hi")
    ? fonts.notoSansDevanagari
    : fonts.spaceGrotesk
}
