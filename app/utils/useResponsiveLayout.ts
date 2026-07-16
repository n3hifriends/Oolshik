import { useCallback } from "react"
import { useWindowDimensions } from "react-native"

// Portrait is the source-of-truth orientation in app.json. This hook still uses
// runtime dimensions so split-screen and future orientation changes stay safe.
const BASE_WIDTH = 390

function clampedScale(value: number, ratio: number, minFactor: number, maxFactor: number): number {
  const factor = Math.min(Math.max(ratio, minFactor), maxFactor)
  return Math.round(value * factor)
}

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions()
  const ratio = width / BASE_WIDTH
  const scaleDisplayText = useCallback(
    (size: number) => clampedScale(size, ratio, 0.88, 1.08),
    [ratio],
  )
  // Tighter clamp for hero/large display numbers (e.g. currency amounts) that
  // need to shrink more aggressively on sub-375px screens to avoid overflow.
  const scaleHeroText = useCallback(
    (size: number) => clampedScale(size, ratio, 0.78, 1.08),
    [ratio],
  )
  const scaleIcon = useCallback(
    (size: number) => clampedScale(size, ratio, 0.9, 1.1),
    [ratio],
  )

  return {
    width,
    height,
    isSmall: width < 375,
    isCompact: width < 380,
    isLarge: width >= 414,
    scaleDisplayText,
    scaleHeroText,
    scaleIcon,
    screenPaddingH: clampedScale(16, ratio, 0.9, 1.15),
  }
}
