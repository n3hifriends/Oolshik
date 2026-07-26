import { Audio, InterruptionModeAndroid, InterruptionModeIOS } from "expo-av"
import { useEffect, useRef, useState } from "react"
import { Platform, PermissionsAndroid } from "react-native"

type State = "idle" | "recording" | "stopped"
export function useAudioRecorder(maxSeconds = 10) {
  const [state, setState] = useState<State>("idle")
  const [uri, setUri] = useState<string | null>(null)
  const [durationSec, setDurationSec] = useState(0)
  const recRef = useRef<Audio.Recording | null>(null)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // request mic permission (Android 12/13 emulator can be picky)
  const askPermission = async () => {
    if (Platform.OS === "android") {
      // If you're bare RN without Expo managed perms, request at runtime:
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        )
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) return false
      } catch {
        return false
      }
    }
    const perm = await Audio.requestPermissionsAsync()
    return perm.granted
  }

  const start = async () => {
    // clean previous recording
    if (recRef.current) {
      try {
        await recRef.current.stopAndUnloadAsync()
      } catch {}
      recRef.current = null
    }
    setUri(null)
    setDurationSec(0)

    const ok = await askPermission()
    if (!ok) return

    // set audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    })

    const recording = new Audio.Recording()
    try {
      await recording.prepareToRecordAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY, // AAC/M4A on both platforms
      )
      await recording.startAsync()
      recRef.current = recording
      setState("recording")

      // poll duration
      tickRef.current = setInterval(async () => {
        const status = await recording.getStatusAsync()
        if (!status.isRecording) return
        const secs = Math.floor((status.durationMillis ?? 0) / 1000)
        setDurationSec(secs)
        if (secs >= maxSeconds) {
          await stop()
        }
      }, 250)
    } catch (e) {
      // common emulator failure: no mic route; fail gracefully
      setState("idle")
      try {
        await recording.stopAndUnloadAsync()
      } catch {}
      recRef.current = null
    }
  }

  const stop = async () => {
    if (!recRef.current) return null
    const recording = recRef.current
    try {
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
      const status = await recording.getStatusAsync().catch(() => null)
      await recording.stopAndUnloadAsync()
      if (recRef.current === recording) recRef.current = null
      const out = recording.getURI()
      const finalDurationSec = Math.max(durationSec, Math.floor((status?.durationMillis ?? 0) / 1000))
      setUri(out ?? null)
      setDurationSec(finalDurationSec)
      setState("stopped")
      return { uri: out ?? null, durationSec: finalDurationSec }
    } catch {
      // ignore
      return null
    }
  }

  const reset = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
    setUri(null)
    setDurationSec(0)
    setState("idle")
    recRef.current?.stopAndUnloadAsync().catch(() => {})
    recRef.current = null
  }

  useEffect(
    () => () => {
      if (tickRef.current) clearInterval(tickRef.current)
      recRef.current?.stopAndUnloadAsync().catch(() => {})
    },
    [],
  )

  const countdown = state === "recording"
    ? Math.max(0, maxSeconds - durationSec)
    : state === "stopped"
      ? 0
      : maxSeconds

  return { uri, start, stop, recording: state === "recording", durationSec, countdown, maxSeconds, reset }
}
