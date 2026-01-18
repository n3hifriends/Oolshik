import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  Modal,
  View as RNView,
  View,
} from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from "react-native-reanimated"

import { Button } from "@/components/Button"
import { Icon } from "@/components/Icon"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"

import { transcribeAudio } from "./transcription"
import { useReduceMotion } from "./useReduceMotion"

let Portal: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("react-native-portal")
  const candidate = mod?.Portal ?? mod?.default ?? mod
  const isLegacy = !!(candidate && (candidate as any).childContextTypes)
  Portal = isLegacy ? null : candidate
} catch {
  Portal = null
}
const ResolvedPortal =
  typeof Portal === "function"
    ? Portal
    : typeof Portal?.Portal === "function"
      ? Portal.Portal
      : null

type ComposerState =
  | "idle"
  | "opening"
  | "voice_recording"
  | "transcribing"
  | "editing"
  | "submitting"
  | "closing"

type ComposerMode = "voice" | "type"

type ComposerSubmitPayload = {
  text: string
  mode: ComposerMode
  voiceNote?: {
    filePath: string
    durationSec: number
  }
}

export interface SpotlightComposerProps {
  onSubmitTask?: (payload: ComposerSubmitPayload) => Promise<void> | void
}

const FAB_SIZE = 56
const FAB_OFFSET_X = 14
const FAB_OFFSET_Y = 10
const PILL_HEIGHT = 66
const PILL_RADIUS = 26
const TOP_SPACING = 32

let BlurComponent: React.ComponentType<any> | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("@react-native-community/blur")
  BlurComponent = mod?.BlurView ?? mod?.default ?? null
} catch {
  BlurComponent = null
}
const hasBlurSupport = !!BlurComponent

const HAPTIC = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("react-native-haptic-feedback")
  } catch {
    return null
  }
})()

const lerp = (a: number, b: number, t: number): number => {
  "worklet"
  return a + (b - a) * t
}

export function SpotlightComposer({ onSubmitTask }: SpotlightComposerProps) {
  const { theme } = useAppTheme()
  const reduceMotion = useReduceMotion()
  const insets = useSafeAreaInsets()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()

  const [state, setState] = useState<ComposerState>("idle")
  const [mode, setMode] = useState<ComposerMode | null>(null)
  const [text, setText] = useState("")
  const [voiceNote, setVoiceNote] = useState<ComposerSubmitPayload["voiceNote"]>(undefined)

  const textInputRef = useRef<TextInput>(null)
  const isMounted = useRef(true)
  const setEditingState = useCallback(() => setState("editing"), [])

  const { uri, start, stop, reset, recording, durationSec } = useAudioRecorder(30)
  const latestRecording = useRef<{ uri: string | null; durationSec: number }>({
    uri: null,
    durationSec: 0,
  })

  const selectedMode = useSharedValue<ComposerMode>("voice")
  const openProgress = useSharedValue(0)
  const suggestionsProgress = useSharedValue(0)
  const pulse = useSharedValue(1)
  const hideMicFab = useSharedValue(0)
  const hidePenFab = useSharedValue(0)
  const scrimOpacity = useSharedValue(0)

  const startVoiceX = useSharedValue(0)
  const startVoiceY = useSharedValue(0)
  const startTypeX = useSharedValue(0)
  const startTypeY = useSharedValue(0)
  const targetX = useSharedValue(0)
  const targetY = useSharedValue(0)
  const targetWidth = useSharedValue(0)

  const durationOpen = reduceMotion ? 160 : 260
  const durationClose = reduceMotion ? 140 : 220
  const durationScrim = reduceMotion ? 120 : 200

  const pillWidth = useMemo(() => Math.min(screenWidth * 0.92, 920), [screenWidth])

  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
      // reset()
    }
  }, [reset])

  useEffect(() => {
    latestRecording.current = { uri, durationSec }
  }, [durationSec, uri])

  useEffect(() => {
    const micCenterX = insets.left + theme.spacing.md + FAB_SIZE / 2
    const micCenterY = screenHeight - insets.bottom - theme.spacing.md - FAB_SIZE / 2
    const penCenterX = micCenterX + FAB_OFFSET_X
    const penCenterY = micCenterY - FAB_OFFSET_Y
    const destY = insets.top + TOP_SPACING + PILL_HEIGHT / 2

    startVoiceX.value = micCenterX
    startVoiceY.value = micCenterY
    startTypeX.value = penCenterX
    startTypeY.value = penCenterY
    targetX.value = screenWidth / 2
    targetY.value = destY
    targetWidth.value = pillWidth
  }, [
    insets.bottom,
    insets.left,
    insets.top,
    pillWidth,
    screenHeight,
    screenWidth,
    startTypeX,
    startTypeY,
    startVoiceX,
    startVoiceY,
    targetWidth,
    targetX,
    targetY,
    theme.spacing.md,
  ])

  useEffect(() => {
    if (state === "voice_recording") {
      pulse.value = withRepeat(
        withTiming(reduceMotion ? 1.05 : 1.18, {
          duration: reduceMotion ? 600 : 820,
          easing: Easing.inOut(Easing.ease),
        }),
        -1,
        true,
      )
    } else {
      pulse.value = withTiming(1, { duration: 180 })
    }
  }, [pulse, reduceMotion, state])

  useEffect(() => {
    if (mode) selectedMode.value = mode
  }, [mode, selectedMode])

  const triggerHaptic = useCallback((type = "impactMedium") => {
    if (HAPTIC?.default?.trigger) {
      HAPTIC.default.trigger(type, {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      })
    }
  }, [])

  const focusInput = useCallback(() => {
    setTimeout(() => {
      textInputRef.current?.focus()
    }, 80)
  }, [])

  const resetState = useCallback(() => {
    setState("idle")
    setMode(null)
    setText("")
    setVoiceNote(undefined)
    hideMicFab.value = 0
    hidePenFab.value = 0
    suggestionsProgress.value = 0
    reset()
  }, [hideMicFab, hidePenFab, reset, suggestionsProgress])

  const closeComposer = useCallback(() => {
    setState("closing")
    scrimOpacity.value = withTiming(0, { duration: durationScrim })
    suggestionsProgress.value = withTiming(0, { duration: durationClose })
    openProgress.value = withTiming(0, { duration: durationClose }, (finished) => {
      if (finished) runOnJS(resetState)()
    })
  }, [durationClose, durationScrim, openProgress, resetState, scrimOpacity, suggestionsProgress])

  const handleVoiceStart = useCallback(async () => {
    setState("voice_recording")
    setVoiceNote(undefined)
    triggerHaptic("impactMedium")
    try {
      setTimeout(() => {
        async function startRecording() {
          await start()
        }
        startRecording()
      }, 100)
    } catch {
      Alert.alert("Microphone unavailable", "Please allow microphone access and try again.", [
        { text: "OK", onPress: closeComposer },
      ])
      closeComposer()
    }
  }, [closeComposer, start, triggerHaptic])

  const handleOpen = useCallback(
    (nextMode: ComposerMode) => {
      if (state !== "idle") return
      setMode(nextMode)
      setState("opening")
      if (nextMode === "voice") {
        hidePenFab.value = withTiming(1, { duration: reduceMotion ? 80 : 140 })
      } else {
        hideMicFab.value = withTiming(1, { duration: reduceMotion ? 80 : 140 })
      }
      triggerHaptic("impactLight")
      scrimOpacity.value = withTiming(1, { duration: durationScrim })
      openProgress.value = 0
      openProgress.value = withSpring(
        1,
        {
          damping: reduceMotion ? 18 : 14,
          stiffness: reduceMotion ? 140 : 210,
        },
        (finished) => {
          if (!finished) return
          suggestionsProgress.value = withDelay(
            reduceMotion ? 40 : 140,
            withTiming(1, { duration: reduceMotion ? 150 : 260 }),
          )
          if (nextMode === "voice") {
            runOnJS(handleVoiceStart)()
          } else {
            runOnJS(setEditingState)()
            runOnJS(focusInput)()
          }
        },
      )
    },
    [
      focusInput,
      handleVoiceStart,
      hideMicFab,
      hidePenFab,
      openProgress,
      scrimOpacity,
      reduceMotion,
      state,
      suggestionsProgress,
      triggerHaptic,
      setEditingState,
    ],
  )

  const handleStopRecording = useCallback(
    async (shouldTranscribe = true) => {
      await stop()
      if (!shouldTranscribe) {
        closeComposer()
        return
      }
      let { uri: filePath, durationSec: recordedDuration } = latestRecording.current
      if (!filePath) {
        // allow state to flush
        await new Promise((r) => setTimeout(r, 50))
        ;({ uri: filePath, durationSec: recordedDuration } = latestRecording.current)
      }
      if (!filePath) {
        closeComposer()
        return
      }
      setVoiceNote({ filePath, durationSec: recordedDuration })
      setState("transcribing")
      try {
        const transcript = await transcribeAudio(filePath)
        if (!isMounted.current || state === "closing") return
        setText(transcript)
        setState("editing")
        focusInput()
      } catch (e) {
        if (!isMounted.current) return
        Alert.alert("Transcription failed", "Please try again.")
        closeComposer()
      }
    },
    [closeComposer, focusInput, state, stop],
  )

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return
    setState("submitting")
    try {
      await onSubmitTask?.({
        text: text.trim(),
        mode: mode ?? "type",
        voiceNote: voiceNote ?? undefined,
      })
      if (Platform.OS === "android") {
        const ToastAndroid = require("react-native").ToastAndroid
        ToastAndroid.show("Task submitted", ToastAndroid.SHORT)
      } else {
        Alert.alert("Submitted", "Task submitted")
      }
    } catch {
      Alert.alert("Unable to submit", "Please try again.")
      setState("editing")
      return
    }
    closeComposer()
  }, [closeComposer, mode, onSubmitTask, text, voiceNote])

  const onScrimPress = useCallback(() => {
    if (state === "voice_recording") {
      Alert.alert("Stop recording?", "Your current recording will be discarded.", [
        { text: "Keep recording", style: "cancel" },
        {
          text: "Stop",
          style: "destructive",
          onPress: () => handleStopRecording(false),
        },
      ])
      return
    } else if (state === "editing" && text.trim().length > 0) {
      Alert.alert("Discard changes?", "Your current changes will be discarded.", [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => closeComposer(),
        },
      ])
      return
    }
    if (state !== "idle") {
      closeComposer()
    }
  }, [closeComposer, handleStopRecording, state])

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
  }))

  const pillStyle = useAnimatedStyle(() => {
    const progress = openProgress.value
    const isVoice = selectedMode.value === "voice"
    const startX = isVoice ? startVoiceX.value : startTypeX.value
    const startY = isVoice ? startVoiceY.value : startTypeY.value
    const width = lerp(FAB_SIZE, targetWidth.value, progress)
    const height = lerp(FAB_SIZE, PILL_HEIGHT, progress)
    const translateX = lerp(startX - width / 2, targetX.value - width / 2, progress)
    const translateY = lerp(startY - height / 2, targetY.value - height / 2, progress / 2)
    const borderRadius = lerp(FAB_SIZE / 2, PILL_RADIUS, progress)

    return {
      width,
      height,
      borderRadius,
      transform: [{ translateX }, { translateY }],
    }
  })

  const suggestionsStyle = useAnimatedStyle(() => ({
    opacity: suggestionsProgress.value,
    transform: [
      {
        translateY: interpolate(suggestionsProgress.value, [0, 1], [12, 0]),
      },
    ],
  }))

  const micFabStyle = useAnimatedStyle(() => ({
    opacity: 1 - hideMicFab.value,
    transform: [{ scale: withTiming(hideMicFab.value ? 0.75 : 1, { duration: 120 }) }],
  }))

  const penFabStyle = useAnimatedStyle(() => ({
    opacity: 1 - hidePenFab.value,
    transform: [{ scale: withTiming(hidePenFab.value ? 0.75 : 1, { duration: 120 }) }],
  }))

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }))

  const pillActiveBackground = theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"

  const renderIdleFabs = () => (
    <View
      pointerEvents={state === "idle" ? "auto" : "none"}
      style={[
        styles.fabStack,
        {
          bottom: insets.bottom + theme.spacing.xxxl,
          left: insets.left + theme.spacing.lg,
        },
      ]}
    >
      <Animated.View style={[styles.fab, styles.fabPen, penFabStyle]}>
        <Pressable
          accessibilityLabel="Type task"
          hitSlop={theme.spacing.sm}
          onPress={() => handleOpen("type")}
          style={[
            styles.fabInner,
            {
              backgroundColor: theme.isDark
                ? "rgba(255,255,255,0.2)"
                : theme.colors.palette.neutral300,
              shadowColor: theme.colors.palette.neutral900,
            },
          ]}
        >
          <MaterialCommunityIcons name="pencil" size={24} color="#a78e8eff" />
        </Pressable>
      </Animated.View>
      <Animated.View style={[styles.fab, micFabStyle]}>
        <Pressable
          accessibilityLabel="Record task"
          hitSlop={theme.spacing.sm}
          onPress={() => handleOpen("voice")}
          style={[
            styles.fabInner,
            {
              backgroundColor: theme.colors.tint,
              shadowColor: theme.colors.palette.neutral900,
            },
          ]}
        >
          <MaterialCommunityIcons name="microphone" size={26} color="#fff" />
        </Pressable>
      </Animated.View>
    </View>
  )

  const renderVoiceContent = () => (
    <View style={styles.contentRow}>
      <Animated.View
        style={[
          styles.iconBubble,
          pulseStyle,
          {
            borderColor: theme.colors.tint,
            backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
          },
        ]}
      >
        <MaterialCommunityIcons name="microphone" size={22} color={theme.colors.tint} />
      </Animated.View>
      <Animated.View
        style={[
          styles.wave,
          pulseStyle,
          {
            backgroundColor: theme.isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.08)",
          },
        ]}
      />
      <Text
        text={formatTime(durationSec)}
        style={[styles.timerText, { color: theme.colors.text }]}
      />
      <Button
        text="Stop"
        accessibilityLabel="Stop recording"
        onPress={() => handleStopRecording(true)}
        style={[styles.smallButton, { marginLeft: 12, alignSelf: "flex-end" }]}
        textStyle={{ fontSize: 14 }}
        preset="default"
      />
    </View>
  )

  const renderTranscribing = () => (
    <View style={styles.contentRow}>
      <MaterialCommunityIcons name="microphone" size={20} color={theme.colors.text} />
      <Text text="Transcribing…" style={styles.helperText} />
      <ActivityIndicator
        size="small"
        color={theme.colors.tint}
        style={{ marginLeft: theme.spacing.sm }}
      />
    </View>
  )

  const renderEditing = () => (
    <View style={styles.editRow}>
      <MaterialCommunityIcons
        name="microphone-outline"
        size={20}
        color={theme.colors.text}
        style={{ marginRight: 10 }}
        onPress={() => {
          // optional affordance to switch into live recording
          if (state === "editing") {
            setMode("voice")
            handleVoiceStart()
          }
        }}
      />
      <TextInput
        ref={textInputRef}
        value={text}
        onChangeText={setText}
        placeholder="Type your task…"
        placeholderTextColor={theme.colors.textDim}
        style={[styles.input, { color: theme.colors.text, display: "none" }]}
        accessibilityLabel="Task input"
        autoFocus={false}
        autoCapitalize="sentences"
        keyboardAppearance={theme.isDark ? "dark" : "light"}
        multiline={false}
      />
      <TouchableOpacity
        accessibilityLabel="Submit task"
        onPress={handleSubmit}
        style={[
          styles.submitPill,
          { backgroundColor: pillActiveBackground, borderColor: theme.colors.border },
        ]}
      >
        <Text text="Submit" style={styles.submitText} />
      </TouchableOpacity>
    </View>
  )

  const renderPillContent = () => {
    switch (state) {
      case "voice_recording":
        return renderVoiceContent()
      case "transcribing":
        return renderTranscribing()
      default:
        return renderEditing()
    }
  }

  const renderSuggestions = () => (
    <Animated.View
      style={[
        styles.suggestionsCard,
        suggestionsStyle,
        {
          backgroundColor: theme.isDark ? "rgba(22,22,26,0.88)" : "rgba(255,255,255,0.9)",
          borderColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
        },
      ]}
    >
      <View style={styles.suggestionHeader}>
        <View style={[styles.dot, { backgroundColor: theme.colors.tint }]} />
        <Text text="1 | 1 km" size="xs" style={{ color: theme.colors.text }} />
      </View>
      <Text text="• Bring groceries" size="sm" style={{ color: theme.colors.text }} />
      <Text text="• Need help with motor" size="sm" style={{ color: theme.colors.text }} />
      <Text text="• Switch on water pump" size="sm" style={{ color: theme.colors.text }} />
    </Animated.View>
  )

  const showOverlay = state !== "idle"

  // overlay content (only the scrim + pill + suggestions); don't include FABs here
  const overlayContent = (
    <Animated.View
      pointerEvents={showOverlay ? "auto" : "none"}
      style={[StyleSheet.absoluteFillObject, { zIndex: 9999, elevation: 9999 }]}
    >
      <Animated.View style={[styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onScrimPress} />
      </Animated.View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.pillContainer, pillStyle]} pointerEvents="box-none">
          {hasBlurSupport && BlurComponent ? (
            <BlurComponent
              blurType={theme.isDark ? "dark" : "light"}
              blurAmount={18}
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <RNView
              style={[
                StyleSheet.absoluteFillObject,
                {
                  backgroundColor: theme.isDark ? "rgba(20,20,24,0.92)" : "rgba(245,245,248,0.92)",
                },
              ]}
            />
          )}
          <RNView
            style={[
              styles.pillInner,
              {
                borderColor: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                backgroundColor: theme.isDark ? "rgba(24,24,28,0.9)" : "rgba(255,255,255,0.96)",
              },
            ]}
          >
            {renderPillContent()}
            {state !== "voice_recording" && (
              <TouchableOpacity
                style={styles.close}
                accessibilityLabel="Close composer"
                onPress={closeComposer}
              >
                <Icon icon="x" />
              </TouchableOpacity>
            )}
          </RNView>
        </Animated.View>

        <RNView
          pointerEvents="box-none"
          style={[
            styles.suggestionContainer,
            { top: insets.top + TOP_SPACING + PILL_HEIGHT + theme.spacing.md },
          ]}
        >
          {/* {renderSuggestions()} */}
        </RNView>
      </KeyboardAvoidingView>
    </Animated.View>
  )

  // Render: idle FABs always in-place; overlay only when active and rendered into Portal/Modal
  return (
    <>
      {renderIdleFabs()}

      {showOverlay &&
        (ResolvedPortal ? (
          <ResolvedPortal>{overlayContent}</ResolvedPortal>
        ) : (
          <Modal
            visible={showOverlay}
            // transparent
            animationType="none"
            onRequestClose={() => {}}
            statusBarTranslucent
          >
            <RNView style={{ flex: 1 }} pointerEvents="box-none">
              {overlayContent}
            </RNView>
          </Modal>
        ))}
    </>
  )
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

const styles = StyleSheet.create({
  close: {
    padding: 8,
    marginLeft: 8,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#57f287",
    marginRight: 8,
  },
  editRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingVertical: 6,
  },
  fab: {
    position: "absolute",
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    zIndex: 2,
  },
  fabInner: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 6 },
  },
  fabPen: {
    left: FAB_OFFSET_X + 30,
    top: -FAB_OFFSET_Y + 30,
  },
  fabStack: {
    position: "absolute",
    zIndex: 50,
    elevation: 20,
  },
  helperText: {
    marginLeft: 10,
  },
  iconBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    paddingVertical: 0,
  },
  pillContainer: {
    position: "absolute",
    overflow: "hidden",
    alignSelf: "center",
    paddingHorizontal: 4,
  },
  pillInner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  smallButton: {
    height: 34,
    paddingHorizontal: 14,
  },
  submitPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  submitText: {
    fontSize: 14,
  },
  suggestionContainer: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
  },
  suggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  suggestionsCard: {
    width: "90%",
    maxWidth: 520,
    borderRadius: 18,
    padding: 16,
    backgroundColor: "rgba(28,28,30,0.8)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
  },
  timerText: {
    marginLeft: 12,
    fontWeight: "600",
  },
  wave: {
    height: 10,
    flex: 1,
    marginHorizontal: 12,
    borderRadius: 6,
  },
})
