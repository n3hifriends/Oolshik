import { useEffect, useRef } from "react"
import { AppState } from "react-native"

export function useOnForeground(callback: () => void) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const prevState = { current: AppState.currentState }
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasBackground = prevState.current === "background" || prevState.current === "inactive"
      prevState.current = nextState
      if (nextState === "active" && wasBackground) {
        callbackRef.current()
      }
    })
    return () => subscription.remove()
  }, [])
}
