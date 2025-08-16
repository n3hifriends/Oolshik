import React, { useState } from "react"
import { View } from "react-native"
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
  const [desc, setDesc] = useState("")
  const [radiusKm, setRadiusKm] = useState<1 | 2 | 5>(1)
  const { uri, start, stop, recording, durationSec, reset } = useAudioRecorder(30)
  const { coords } = useForegroundLocation()
  const { userId, userName } = useAuth()
  const { tasks } = useTaskStore()

  const uploadAndCreate = async () => {
    if (!coords) return alert("No location yet")

    // Require audio only when real upload is used
    if (!FLAGS.USE_MOCK_UPLOAD_CREATE && !uri) return alert("Please record audio")

    // 1) presigned (mock returns fake fileUrl; real returns S3 urls)
    const presigned = await OolshikApi.getPresigned("audio/m4a")
    if (!presigned.ok || !presigned.data) return alert("Upload URL error")
    const { uploadUrl, fileUrl } = presigned.data

    // 2) upload (SKIPPED IN MOCK MODE)
    if (!FLAGS.USE_MOCK_UPLOAD_CREATE) {
      const file = await FileSystem.readAsStringAsync(uri!, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const resp = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "audio/m4a" },
        body: Buffer.from(file, "base64"),
      })
      if (resp.status < 200 || resp.status >= 300) return alert("Upload failed")
    }

    const fallbackVoice = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"

    // 3) create (mock returns ok with fake task; real hits backend)
    const res = await OolshikApi.createTask({
      voiceUrl: FLAGS.USE_MOCK_UPLOAD_CREATE ? fallbackVoice : fileUrl,
      description: desc || undefined,
      lat: coords.latitude,
      lng: coords.longitude,
      radiusKm,
      createdById: userId,
      createdByName: userName,
      createdAt: new Date().toISOString(),
    })

    if (res.ok) {
      reset()
      tasks.unshift(res.data as Task)
      navigation.goBack()
    } else {
      alert("Create failed")
    }
  }

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <Text preset="heading" text="Create Task" />
      <TextField value={desc} onChangeText={setDesc} placeholder="Short text (optional)" />
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
      <View style={{ flexDirection: "row", gap: 8 }}>
        {!recording && <Button text="Record ≤30s" onPress={start} />}
        {recording && <Button text={`Stop (${durationSec}s)`} onPress={stop} />}
      </View>
      <Button text="Post" onPress={uploadAndCreate} />
    </Screen>
  )
}
