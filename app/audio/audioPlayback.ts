import React from "react"
import { AppState, AppStateStatus } from "react-native"
import { Audio } from "expo-av"

type PlaybackState = {
  status: "idle" | "loading" | "playing"
  uri: string | null
  key: string | null
}

type Listener = (state: PlaybackState) => void

class AudioPlaybackManager {
  private sound: Audio.Sound | null = null
  private state: PlaybackState = { status: "idle", uri: null, key: null }
  private listeners = new Set<Listener>()
  private playSeq = 0
  private audioModeReady = false

  constructor() {
    AppState.addEventListener("change", this.handleAppState)
  }

  private handleAppState = (nextState: AppStateStatus) => {
    if (nextState === "background") {
      void this.stop()
    }
  }

  private emit(next: PlaybackState) {
    this.state = next
    this.listeners.forEach((listener) => listener(this.state))
  }

  getState() {
    return this.state
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private async ensureAudioMode() {
    if (this.audioModeReady) return
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: Audio.InterruptionModeIOS.DuckOthers,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.InterruptionModeAndroid.DuckOthers,
        playThroughEarpieceAndroid: false,
      })
    } catch {
      // best-effort: don't block playback if audio mode setup fails
    }
    this.audioModeReady = true
  }

  async toggle(uri?: string | null, key?: string | null) {
    if (!uri) return
    const isSame = key ? this.state.key === key : this.state.uri === uri
    if (isSame && this.state.status === "playing") {
      await this.stop()
      return
    }
    await this.play(uri, key)
  }

  async play(uri: string, key?: string | null) {
    if (!uri) return
    const seq = ++this.playSeq
    this.emit({ status: "loading", uri, key: key ?? null })
    try {
      await this.ensureAudioMode()

      if (seq !== this.playSeq) return

      if (this.sound) {
        try {
          await this.sound.stopAsync()
        } catch {}
        try {
          await this.sound.unloadAsync()
        } catch {}
        this.sound = null
      }

      const { sound } = await Audio.Sound.createAsync({ uri })
      if (seq !== this.playSeq) {
        try {
          await sound.unloadAsync()
        } catch {}
        return
      }
      this.sound = sound
      sound.setOnPlaybackStatusUpdate((st: any) => {
        if (!st?.isLoaded) return
        if (st.didJustFinish) {
          void this.stop()
        }
      })

      await sound.playAsync()
      this.emit({ status: "playing", uri, key: key ?? null })
    } catch {
      if (seq === this.playSeq) {
        this.emit({ status: "idle", uri: null, key: null })
      }
    }
  }

  async stop() {
    this.playSeq++
    if (this.sound) {
      try {
        await this.sound.stopAsync()
      } catch {}
      try {
        await this.sound.unloadAsync()
      } catch {}
      this.sound = null
    }
    this.emit({ status: "idle", uri: null, key: null })
  }
}

const manager = new AudioPlaybackManager()

export function useAudioPlayback() {
  const [state, setState] = React.useState(manager.getState())
  React.useEffect(() => manager.subscribe(setState), [])
  const toggle = React.useCallback(
    (uri?: string | null, key?: string | null) => manager.toggle(uri, key),
    [],
  )
  const stop = React.useCallback(() => manager.stop(), [])
  return { ...state, toggle, stop }
}

export function useAudioPlaybackForUri(targetUri?: string | null, targetKey?: string | null) {
  const uriRef = React.useRef<string | null>(targetUri ?? null)
  uriRef.current = targetUri ?? null
  const keyRef = React.useRef<string | null>(targetKey ?? null)
  keyRef.current = targetKey ?? null
  const [state, setState] = React.useState(manager.getState())
  const stateRef = React.useRef(state)
  stateRef.current = state
  const matches = (candidate: PlaybackState, key?: string | null, uri?: string | null) =>
    key ? candidate.key === key : !!uri && candidate.uri === uri

  React.useEffect(() => {
    return manager.subscribe((next) => {
      const target = uriRef.current
      const key = keyRef.current
      if (!target && !key) return
      const wasActive = matches(stateRef.current, key, target)
      const isActive = matches(next, key, target)
      if (wasActive || isActive) {
        stateRef.current = next
        setState(next)
      }
    })
  }, [])

  const isActive = matches(state, keyRef.current, uriRef.current)
  const status = isActive ? state.status : "idle"
  const toggle = React.useCallback(() => manager.toggle(uriRef.current, keyRef.current), [])
  const stop = React.useCallback(() => manager.stop(), [])
  return { status, isActive, toggle, stop, uri: uriRef.current, key: keyRef.current }
}
