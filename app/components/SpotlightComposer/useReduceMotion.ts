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
      subscription?.remove?.()
    }
  }, [])

  return reduceMotion
}
