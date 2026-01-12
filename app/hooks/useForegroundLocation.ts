import * as Location from "expo-location"
import { useCallback, useEffect, useRef, useState } from "react"

type LatLng = { latitude: number; longitude: number }
type LocationStatus = "idle" | "loading" | "ready" | "denied" | "error"

export function useForegroundLocation() {
  const [coords, setCoords] = useState<LatLng | null>(null)
  const [lastKnown, setLastKnown] = useState<LatLng | null>(null)
  const [granted, setGranted] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<LocationStatus>("idle")
  const watcherRef = useRef<Location.LocationSubscription | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const refresh = useCallback(() => {
    setRefreshToken((v) => v + 1)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      try {
        watcherRef.current?.remove()
        watcherRef.current = null
        if (!cancelled) {
          setError(null)
          setStatus("loading")
        }

        const { status } = await Location.requestForegroundPermissionsAsync()
        const ok = status === Location.PermissionStatus.GRANTED
        if (!cancelled) setGranted(ok)
        if (!ok) {
          if (!cancelled) {
            setCoords(null)
            setLastKnown(null)
            setStatus("denied")
          }
          return
        }

        const lastKnown = await Location.getLastKnownPositionAsync()
        if (!cancelled && lastKnown?.coords) {
          const cached = {
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          }
          setLastKnown(cached)
          setCoords(cached)
          setStatus("ready")
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        if (!cancelled) {
          setCoords({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          })
          setStatus("ready")
        }

        watcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 30_000,
            distanceInterval: 50,
          },
          (update) => {
            if (cancelled || !update?.coords) return
            setCoords({
              latitude: update.coords.latitude,
              longitude: update.coords.longitude,
            })
            setStatus("ready")
          },
        )
      } catch (e: any) {
        console.log("🚀 ~ bootstrap ~ e:", e)
        if (!cancelled) {
          setCoords(null)
          setLastKnown(null)
          setError(e?.message ?? "Location error")
          setStatus("error")
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
      watcherRef.current?.remove()
      watcherRef.current = null
    }
  }, [refreshToken])

  return { coords, lastKnown, granted, error, status, refresh, request: refresh }
}
