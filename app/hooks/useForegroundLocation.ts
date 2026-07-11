import * as Location from "expo-location"
import { useCallback, useEffect, useRef, useState } from "react"
import { useRemoteConfig } from "@/services/remoteConfig"
import { breadcrumb, setLocationContext } from "@/utils/crashReporting"
import { useOnForeground } from "@/hooks/useOnForeground"

type LatLng = { latitude: number; longitude: number }
type LocationStatus = "idle" | "loading" | "ready" | "denied" | "error"
type LocationOptions = { autoRequest?: boolean }

export function useForegroundLocation(options: LocationOptions = {}) {
  const [coords, setCoords] = useState<LatLng | null>(null)
  const [lastKnown, setLastKnown] = useState<LatLng | null>(null)
  const [granted, setGranted] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<LocationStatus>("idle")
  const watcherRef = useRef<Location.LocationSubscription | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const autoRequest = options.autoRequest !== false

  const { feature_location_capture_enabled: locationEnabled } = useRemoteConfig()

  const refresh = useCallback(() => {
    setRefreshToken((v) => v + 1)
  }, [])

  // Track whether we have already established a location so foreground refreshes
  // don't flash the "loading" / "error" state while silently re-acquiring.
  const hasLocationRef = useRef(false)

  // Only refresh on foreground if we previously had a location.
  // If we've never acquired one (e.g. emulator with no location source), let the
  // 12s timeout run to completion so the user reaches the error state and can retry.
  // Resetting on every foreground event cancels the in-flight getCurrentPositionAsync
  // and restarts the timer, causing an infinite "Getting your location…" loop.
  const foregroundRefresh = useCallback(() => {
    if (hasLocationRef.current) {
      setRefreshToken((v) => v + 1)
    }
  }, [])

  useOnForeground(foregroundRefresh)

  useEffect(() => {
    if (!locationEnabled) {
      setCoords(null)
      setLastKnown(null)
      setGranted(false)
      setStatus("idle")
      watcherRef.current?.remove()
      watcherRef.current = null
      hasLocationRef.current = false
      return
    }
    let cancelled = false

    async function bootstrap() {
      try {
        // On a foreground re-check (refreshToken > 0), keep the existing watcher
        // and coords visible while silently verifying permission and getting a fresh
        // fix. Only tear down and show "loading" on the very first mount.
        const isSilentRefresh = refreshToken > 0 && hasLocationRef.current

        if (!isSilentRefresh) {
          watcherRef.current?.remove()
          watcherRef.current = null
          if (!cancelled) {
            setError(null)
            setStatus("loading")
          }
        }

        let ok = false
        // Silent foreground refreshes use getForegroundPermissionsAsync (read-only).
        // requestForegroundPermissionsAsync triggers a system-level check that
        // briefly puts the app into "inactive" state even when permission is already
        // granted, which fires useOnForeground again and creates an AppState loop.
        if (!autoRequest && refreshToken === 0) {
          const perm = await Location.getForegroundPermissionsAsync()
          ok = perm.status === Location.PermissionStatus.GRANTED
        } else if (isSilentRefresh) {
          const perm = await Location.getForegroundPermissionsAsync()
          ok = perm.status === Location.PermissionStatus.GRANTED
        } else {
          breadcrumb("location:permission_requested")
          const perm = await Location.requestForegroundPermissionsAsync()
          ok = perm.status === Location.PermissionStatus.GRANTED
          const permResult = ok ? "granted" : perm.canAskAgain === false ? "blocked" : "denied"
          breadcrumb(`location:permission_result status=${permResult}`)
          setLocationContext({ permission: permResult })
        }
        if (!cancelled) setGranted(ok)
        if (!ok) {
          if (!cancelled) {
            setCoords(null)
            setLastKnown(null)
            setStatus("denied")
            hasLocationRef.current = false
          }
          return
        }
        setLocationContext({ permission: "granted" })

        if (!isSilentRefresh) {
          const lastKnown = await Location.getLastKnownPositionAsync()
          if (!cancelled && lastKnown?.coords) {
            const cached = {
              latitude: lastKnown.coords.latitude,
              longitude: lastKnown.coords.longitude,
            }
            setLastKnown(cached)
            setCoords(cached)
            setStatus("ready")
            hasLocationRef.current = true
          }
        }

        const LOCATION_TIMEOUT_MS = 12_000
        const current = await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("location_timeout")), LOCATION_TIMEOUT_MS),
          ),
        ])
        if (!cancelled) {
          setCoords({
            latitude: current.coords.latitude,
            longitude: current.coords.longitude,
          })
          setStatus("ready")
          hasLocationRef.current = true
        }

        if (!isSilentRefresh) {
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
        }
      } catch (e: any) {
        if (cancelled) return
        breadcrumb("location:refresh_failed kind=exception")
        try {
          const fallback = await Location.getLastKnownPositionAsync()
          if (!cancelled && fallback?.coords) {
            setCoords({
              latitude: fallback.coords.latitude,
              longitude: fallback.coords.longitude,
            })
            setStatus("ready")
            hasLocationRef.current = true
            return
          }
        } catch {
          // ignore secondary failure
        }
        // Only show error state if we have nothing to show the user.
        if (!cancelled && !hasLocationRef.current) {
          setCoords(null)
          setLastKnown(null)
          setError(e?.message ?? "Location error")
          setStatus("error")
          setLocationContext({ permission: "unknown" })
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
      watcherRef.current?.remove()
      watcherRef.current = null
    }
  }, [refreshToken, autoRequest, locationEnabled])

  return { coords, lastKnown, granted, error, status, refresh, request: refresh }
}
