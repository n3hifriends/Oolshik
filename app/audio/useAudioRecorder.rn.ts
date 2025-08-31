// app/audio/useAudioRecorder.rn.ts
// Bare React Native path using react-native-audio-recorder-player
import { useEffect, useRef, useState } from "react"
import { Platform, PermissionsAndroid, Alert } from "react-native"
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
} from "react-native-audio-recorder-player"

export type RecordingState = "idle" | "recording" | "paused" | "stopped"
export type Recording = { path: string; durationMs: number }

export function useAudioRecorder() {
  const arpRef = useRef(new AudioRecorderPlayer())
  const [state, setState] = useState<RecordingState>("idle")
  const [path, setPath] = useState<string | null>(null)
  const [durationMs, setDurationMs] = useState(0)

  useEffect(() => {
    return () => {
      try {
        arpRef.current.stopRecorder()
      } catch {}
    }
  }, [])

  const requestPermission = async () => {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
      ])
      if (
        granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] !== PermissionsAndroid.RESULTS.GRANTED
      ) {
        Alert.alert("Permission required", "Recording permission is needed.")
        return false
      }
    }
    return true
  }

  const start = async () => {
    if (!(await requestPermission())) return
    const fname = `oolshik_${Date.now()}.m4a`
    const uri = Platform.select({ ios: `/${fname}`, android: undefined })
    const result = await arpRef.current.startRecorder(uri, {
      quality: AVEncoderAudioQualityIOSType.high,
      audioSource: 6,
      AVNumberOfChannelsKeyIOS: 1,
      AVFormatIDKeyIOS: AVEncodingOption.aac,
      SampleRateIOS: 44100,
    })
    setPath(result)
    setState("recording")
    arpRef.current.addRecordBackListener((e) => setDurationMs(e.currentPosition))
  }

  const pause = async () => {
    if (state === "recording") {
      await arpRef.current.pauseRecorder()
      setState("paused")
    }
  }
  const resume = async () => {
    if (state === "paused") {
      await arpRef.current.resumeRecorder()
      setState("recording")
    }
  }
  const stop = async (): Promise<Recording | null> => {
    if (state === "idle") return null
    const result = await arpRef.current.stopRecorder()
    arpRef.current.removeRecordBackListener()
    setState("stopped")
    setPath(result)
    return { path: result, durationMs }
  }

  return { state, start, pause, resume, stop, path, durationMs }
}
