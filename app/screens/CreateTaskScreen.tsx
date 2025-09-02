import React, { useState, useRef, useEffect } from "react"
import { View, Alert, ActivityIndicator } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { Button } from "@/components/Button"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { OolshikApi } from "@/api"
import * as FileSystem from "expo-file-system"
import { Audio } from "expo-av"
import { RadioGroup } from "@/components/RadioGroup"
import { useAuth } from "@/context/AuthContext"
import { FLAGS } from "@/config/flags"
import { useTaskStore } from "@/store/taskStore"
import { Task } from "@/api/client"
import { uploadAudioSmart } from "@/audio/uploadAudio"

type Radius = 1 | 2 | 5

export default function CreateTaskScreen({ navigation }: any) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [radiusKm, setRadiusKm] = useState<Radius>(1)
  const [submitting, setSubmitting] = useState(false)
  const [audioAccepted, setAudioAccepted] = useState(false)
  const soundRef = useRef<Audio.Sound | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackSecs, setPlaybackSecs] = useState(0)
  const MAX_DESC = 500

  const { uri, start, stop, recording, durationSec, reset } = useAudioRecorder(30)
  const { coords } = useForegroundLocation()
  const { userId, userName } = useAuth()
  const { tasks } = useTaskStore()

  // Load/unload preview sound when a new recording is available
  useEffect(() => {
    let mounted = true
    const load = async () => {
      if (!uri) {
        if (soundRef.current) {
          try {
            await soundRef.current.unloadAsync()
          } catch {}
          soundRef.current = null
        }
        setIsPlaying(false)
        setPlaybackSecs(0)
        setAudioAccepted(false)
        return
      }
      try {
        if (soundRef.current) {
          try {
            await soundRef.current.unloadAsync()
          } catch {}
          soundRef.current = null
        }
        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: false })
        sound.setOnPlaybackStatusUpdate((status) => {
          if (!mounted) return
          if (!status.isLoaded) return
          setPlaybackSecs(Math.floor((status.positionMillis || 0) / 1000))
          setIsPlaying(!!status.isPlaying)
          if ((status as any).didJustFinish) {
            // when playback completes, keep the counter at the end
            setIsPlaying(false)
          }
        })
        soundRef.current = sound
      } catch {}
    }
    load()
    return () => {
      mounted = false
    }
  }, [uri])

  const togglePlay = async () => {
    const sound = soundRef.current
    if (!sound) return
    const status = await sound.getStatusAsync()
    if (!status.isLoaded) return
    if (status.isPlaying) {
      await sound.pauseAsync()
    } else {
      try {
        await sound.setPositionAsync(0)
      } catch {}
      setPlaybackSecs(0)
      await sound.playAsync()
    }
  }

  const discardRecording = async () => {
    try {
      await soundRef.current?.unloadAsync()
    } catch {}
    soundRef.current = null
    setIsPlaying(false)
    setPlaybackSecs(0)
    setAudioAccepted(false)
    reset()
  }

  const handlePost = async () => {
    if (!coords) {
      Alert.alert("Location not ready", "Please enable location to post your request.")
      return
    }
    if (!title.trim()) {
      Alert.alert("Missing title", "Please enter a title for your request.")
      return
    }

    setSubmitting(true)
    try {
      // Decide if we will actually upload a recorded file
      // const wantRealUpload = false && !!uri && audioAccepted

      const fallbackVoice = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
      let finalVoiceUrl = fallbackVoice

      // if (!wantRealUpload) {
      // inside handlePost:
      let voiceUrl: string | undefined

      if (uri && audioAccepted) {
        const res = await uploadAudioSmart({
          uri,
          filename: `voice_${Date.now()}.m4a`,
          mimeType: "audio/m4a",
          durationMs: durationSec * 1000,
        })
        if (!res.ok) {
          Alert.alert("Upload failed", "Please try again.")
          setSubmitting(false)
          return
        }
        voiceUrl = res.url
      }
      finalVoiceUrl = "" + voiceUrl
      // }

      // 3) create (mock returns ok with fake task; real hits backend)
      const payload = {
        title: title.trim(),
        description: description.trim() || undefined,
        voiceUrl: finalVoiceUrl,
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusMeters: radiusKm * 1000,
        createdById: userId,
        createdByName: userName,
        createdAt: new Date().toISOString(),
      }

      const res = await OolshikApi.createTask(payload)

      if (res.ok && res.data) {
        try {
          await soundRef.current?.unloadAsync()
        } catch {}
        soundRef.current = null
        setAudioAccepted(false)
        setIsPlaying(false)
        setPlaybackSecs(0)
        reset()
        tasks.unshift(res.data as Task)
        Alert.alert("Posted", "Your request has been created successfully.", [
          { text: "OK", onPress: () => navigation.goBack() },
        ])
      } else {
        const errMsg =
          (res as any)?.data?.message ||
          (res as any)?.problem ||
          (res as any)?.originalError?.message ||
          "Please try again."
        Alert.alert("Create failed", errMsg)
      }
    } catch (e: any) {
      Alert.alert("Create failed", e?.message ?? "Unexpected error occurred.")
    } finally {
      setSubmitting(false)
    }
  }

  const onStartPress = async () => {
    try {
      await start()
    } catch (e: any) {
      Alert.alert("Recorder error", e?.message ?? "Microphone not available")
    }
  }

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <Text preset="heading" text="Create Task" />

      {/* Title */}
      <View style={{ gap: 6 }}>
        <Text text="Title" style={{ fontWeight: "600", opacity: 0.9 }} />
        <TextField
          value={title}
          onChangeText={setTitle}
          placeholder="Give a short title"
          maxLength={80}
          autoCapitalize="sentences"
          autoCorrect
          returnKeyType="next"
        />
      </View>

      {/* Description */}
      <View style={{ gap: 6 }}>
        <Text text="Description" style={{ fontWeight: "600", opacity: 0.9 }} />
        <TextField
          value={description}
          onChangeText={(t) => setDescription(t.slice(0, MAX_DESC))}
          placeholder="Describe what you need (optional)"
          multiline
          numberOfLines={5}
          style={{ minHeight: 120, textAlignVertical: "top" }}
          autoCapitalize="sentences"
          autoCorrect
        />
        <Text
          style={{ alignSelf: "flex-end" }}
          preset="default"
          text={`${description.length}/${MAX_DESC}`}
        />
      </View>

      {/* Radius */}
      <View style={{ gap: 6 }}>
        <Text
          text="Show my request to helpers within:"
          style={{ fontWeight: "600", opacity: 0.9 }}
        />
        <RadioGroup
          value={radiusKm}
          onChange={(v) => setRadiusKm(v as Radius)}
          options={[
            { label: "1 km", value: 1 },
            { label: "2 km", value: 2 },
            { label: "5 km", value: 5 },
          ]}
          size="md"
          gap={8}
        />
      </View>
      {/* Recorder */}
      <View style={{ flexDirection: "column", gap: 10, marginTop: 12, marginBottom: 24 }}>
        <Text text="Record Voice Note (30s max):" style={{ fontWeight: "600", opacity: 0.9 }} />
        {!recording && !uri && <Button text="Record ≤30s" onPress={onStartPress} />}
        {recording && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <ActivityIndicator />
            <Button text={`Stop (${durationSec}s)`} onPress={stop} />
          </View>
        )}
        {!recording && uri && (
          <View
            style={{
              borderWidth: 1,
              borderColor: "#e5e7eb",
              borderRadius: 12,
              padding: 12,
              backgroundColor: "#fafafa",
              gap: 10,
            }}
          >
            <Text preset="subheading" text="Preview your recording" />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Button text={isPlaying ? "Pause" : "Play"} onPress={togglePlay} />
              <Text
                text={`${playbackSecs}s / ${Math.max(durationSec, Math.ceil(playbackSecs))}s`}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {!audioAccepted && (
                <Button text="Use this audio" onPress={() => setAudioAccepted(true)} />
              )}
              {audioAccepted && (
                <Text
                  text="Audio selected"
                  style={{ color: "#16a34a", fontWeight: "600", paddingVertical: 10 }}
                />
              )}
              <Button text="Discard & Re-record" onPress={discardRecording} />
            </View>
            {!audioAccepted && (
              <Text
                text={'(Audio will not be attached unless you tap "Use this audio")'}
                style={{ opacity: 0.7 }}
              />
            )}
          </View>
        )}
      </View>

      {/* Submit */}
      <Button
        text={submitting ? "Posting..." : "Post"}
        onPress={handlePost}
        disabled={submitting || !coords}
      />
    </Screen>
  )
}
