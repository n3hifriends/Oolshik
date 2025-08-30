import React, { useState } from "react"
import { View, Alert } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { Button } from "@/components/Button"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { OolshikApi } from "@/api"
import * as FileSystem from "expo-file-system"
import { RadioGroup } from "@/components/RadioGroup"
import { useAuth } from "@/context/AuthContext"
import { FLAGS } from "@/config/flags"
import { useTaskStore } from "@/store/taskStore"
import { Task } from "@/api/client"

type Radius = 1 | 2 | 5

export default function CreateTaskScreen({ navigation }: any) {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [radiusKm, setRadiusKm] = useState<Radius>(1)
  const [submitting, setSubmitting] = useState(false)
  const MAX_DESC = 500

  const { uri, start, stop, recording, durationSec, reset } = useAudioRecorder(30)
  const { coords } = useForegroundLocation()
  const { userId, userName } = useAuth()
  const { tasks } = useTaskStore()

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
      const wantRealUpload = !FLAGS.USE_MOCK_UPLOAD_CREATE && !!uri

      const fallbackVoice = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
      let finalVoiceUrl = fallbackVoice

      if (wantRealUpload) {
        // 1) presigned (real returns S3 urls)
        const presigned = await OolshikApi.getPresigned("audio/m4a")
        if (!presigned.ok || !presigned.data) {
          Alert.alert("Upload URL error", "Couldn't get a secure upload URL. Please try again.")
          setSubmitting(false)
          return
        }
        const { uploadUrl, fileUrl } = presigned.data

        // 2) upload recorded file
        const fileB64 = await FileSystem.readAsStringAsync(uri!, {
          encoding: FileSystem.EncodingType.Base64,
        })
        const resp = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "audio/m4a" },
          // In React Native, fetch accepts a string for base64 bodies only when server expects base64.
          // S3 expects binary; for emulator convenience, rely on fallback in mock mode.
          body: Buffer.from(fileB64, "base64"),
        })
        if (resp.status < 200 || resp.status >= 300) {
          Alert.alert("Upload failed", "We couldn't upload your voice note. Please try again.")
          setSubmitting(false)
          return
        }
        finalVoiceUrl = fileUrl
      }

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
      <View style={{ flexDirection: "column", gap: 8, marginTop: 12, marginBottom: 24 }}>
        <Text text="Record Voice Note (30s max):" style={{ fontWeight: "600", opacity: 0.9 }} />
        {!recording && <Button text="Record ≤30s" onPress={start} />}
        {recording && <Button text={`Stop (${durationSec}s)`} onPress={stop} />}
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
