import * as Location from "expo-location"
import { useEffect, useState } from "react"

type LatLng = { latitude: number; longitude: number }

export function useForegroundLocation() {
  const [coords, setCoords] = useState<LatLng | null>(null)
  const [granted, setGranted] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let watcher: Location.LocationSubscription | null = null
    let cancelled = false

    async function bootstrap() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        const ok = status === Location.PermissionStatus.GRANTED
        if (!cancelled) setGranted(ok)
        if (!ok) return

        const lastKnown = await Location.getLastKnownPositionAsync()
        if (!cancelled && lastKnown?.coords) {
          setCoords({
            latitude: lastKnown.coords.latitude,
            longitude: lastKnown.coords.longitude,
          })
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
        if (!cancelled) {
          setCoords({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          })
        }

        watcher = await Location.watchPositionAsync(
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
          },
        )
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Location error")
      }
    }

    bootstrap()

    return () => {
      cancelled = true
      watcher?.remove()
    }
  }, [])

  return { coords, granted, error }
}
