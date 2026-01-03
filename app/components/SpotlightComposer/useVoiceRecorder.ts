import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Platform } from "react-native"
import AudioRecorderPlayer from "react-native-audio-recorder-player"
import { check, PERMISSIONS, request, RESULTS } from "react-native-permissions"

type StartResult = { ok: true } | { ok: false; reason: "permission" | "error" }
type StopResult = { filePath?: string | null; durationSec: number }

export function useVoiceRecorder() {
  const recorder = useRef(new AudioRecorderPlayer()).current
  const backListener = useRef<ReturnType<AudioRecorderPlayer["addRecordBackListener"]> | null>(null)

  const [durationSec, setDurationSec] = useState(0)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)

  const permission = useMemo(
    () =>
      Platform.select({
        ios: PERMISSIONS.IOS.MICROPHONE,
        android: PERMISSIONS.ANDROID.RECORD_AUDIO,
        default: undefined,
      }),
    [],
  )

  const requestPermission = useCallback(async () => {
    if (!permission) return false
    const status = await check(permission)
    if (status === RESULTS.GRANTED) return true
    const next = await request(permission)
    return next === RESULTS.GRANTED
  }, [permission])

  const start = useCallback(async (): Promise<StartResult> => {
    const allowed = await requestPermission()
    if (!allowed) return { ok: false, reason: "permission" }

    try {
      setDurationSec(0)
      setFilePath(null)
      setIsRecording(true)
      const uri = await recorder.startRecorder()
      setFilePath(uri ?? null)
      backListener.current = recorder.addRecordBackListener((e) => {
        setDurationSec(Math.floor((e.currentPosition ?? 0) / 1000))
      })
      return { ok: true }
    } catch {
      setIsRecording(false)
      return { ok: false, reason: "error" }
    }
  }, [recorder, requestPermission])

  const stop = useCallback(async (): Promise<StopResult> => {
    try {
      const uri = await recorder.stopRecorder()
      backListener.current?.()
      backListener.current = null
      setIsRecording(false)
      return { filePath: uri ?? filePath, durationSec }
    } catch {
      setIsRecording(false)
      return { filePath: filePath ?? null, durationSec }
    }
  }, [durationSec, filePath, recorder])

  const reset = useCallback(() => {
    try {
      recorder.stopRecorder()
    } catch {
      // ignore
    }
    backListener.current?.()
    backListener.current = null
    setIsRecording(false)
    setDurationSec(0)
    setFilePath(null)
  }, [recorder])

  useEffect(
    () => () => {
      reset()
    },
    [reset],
  )

  return {
    start,
    stop,
    reset,
    durationSec,
    filePath,
    isRecording,
  }
}
