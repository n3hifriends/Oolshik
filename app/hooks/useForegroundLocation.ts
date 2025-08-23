import * as Location from "expo-location"
import { useEffect, useState } from "react"

export function useForegroundLocation() {
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [granted, setGranted] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync()
        const ok = status === Location.PermissionStatus.GRANTED
        setGranted(ok)
        if (!ok) return
        const current = await Location.getCurrentPositionAsync({})
        setCoords({ latitude: current.coords.latitude, longitude: current.coords.longitude })
      } catch (e: any) {
        setError(e?.message ?? "Location error")
      }
    })()
  }, [])

  return { coords, granted, error }
}
