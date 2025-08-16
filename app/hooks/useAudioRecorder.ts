import { useEffect, useRef, useState } from "react"
import { Audio } from "expo-av"

export function useAudioRecorder(maxSeconds: number = 30) {
  const recordingRef = useRef<Audio.Recording | null>(null)
  const [uri, setUri] = useState<string | null>(null)
  const [recording, setRecording] = useState<boolean>(false)
  const [durationSec, setDurationSec] = useState<number>(0)

  useEffect(() => {
    let interval: any
    if (recording) {
      interval = setInterval(() => setDurationSec((s) => s + 1), 1000)
    } else {
      clearInterval(interval)
    }
    return () => clearInterval(interval)
  }, [recording])

  const start = async () => {
    const perm = await Audio.requestPermissionsAsync()
    if (perm.status !== "granted") throw new Error("Audio permission denied")
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
    const rec = new Audio.Recording()
    await rec.prepareToRecordAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    )
    await rec.startAsync()
    recordingRef.current = rec
    setDurationSec(0)
    setRecording(true)
  }

  const stop = async () => {
    const rec = recordingRef.current
    if (!rec) return null
    await rec.stopAndUnloadAsync()
    const u = rec.getURI()
    setUri(u ?? null)
    setRecording(false)
    return u
  }

  const reset = () => {
    recordingRef.current = null
    setUri(null)
    setDurationSec(0)
    setRecording(false)
  }

  useEffect(() => {
    if (recording && durationSec >= maxSeconds) stop()
  }, [recording, durationSec, maxSeconds])

  return { start, stop, reset, uri, recording, durationSec }
}
