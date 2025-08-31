// app/audio/useAudioRecorder.expo.ts
// Expo path using expo-av
import { Audio } from "expo-av"
import { useEffect, useRef, useState } from "react"

export type RecordingState = "idle" | "recording" | "paused" | "stopped"
export type Recording = { path: string; durationMs: number }

export function useAudioRecorder() {
  const [state, setState] = useState<RecordingState>("idle")
  const [path, setPath] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState(0)
  const recRef = useRef<Audio.Recording | null>(null)

  useEffect(() => { return () => { try { recRef.current?.stopAndUnloadAsync() } catch {} } }, [])

  const start = async () => {
    const perm = await Audio.requestPermissionsAsync()
    if (!perm.granted) return
    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })
    const recording = new Audio.Recording()
    await recording.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY)
    await recording.startAsync()
    recRef.current = recording
    setState("recording")
    const interval = setInterval(async () => {
      const s = await recording.getStatusAsync()
      if (s.isRecording) setDurationMs(s.durationMillis || 0)
      else clearInterval(interval)
    }, 300)
  }

  const pause = async () => { await recRef.current?.pauseAsync(); setState("paused") }
  const resume = async () => { await recRef.current?.startAsync(); setState("recording") }
  const stop = async (): Promise<Recording | null> => {
    if (!recRef.current) return null
    await recRef.current.stopAndUnloadAsync()
    const uri = recRef.current.getURI()!
    setPath(uri)
    setState("stopped")
    return { path: uri, durationMs }
  }

  return { state, start, pause, resume, stop, path, durationMs }
}