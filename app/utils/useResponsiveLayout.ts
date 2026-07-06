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
  const scaleIcon = useCallback(
    (size: number) => clampedScale(size, ratio, 0.9, 1.1),
    [ratio],
  )

  return {
    width,
    height,
    isSmall: width < 375,
    isLarge: width >= 414,
    scaleDisplayText,
    scaleIcon,
    screenPaddingH: clampedScale(16, ratio, 0.9, 1.15),
  }
}
