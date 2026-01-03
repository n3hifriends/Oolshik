import { useEffect, useState } from "react"
import { AccessibilityInfo } from "react-native"

export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {})

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled: boolean) => setReduceMotion(enabled),
    )

    return () => {
      // RN 0.79 event returns remove method
      // @ts-expect-error RN types mismatch across versions
      subscription?.remove?.()
    }
  }, [])

  return reduceMotion
}
