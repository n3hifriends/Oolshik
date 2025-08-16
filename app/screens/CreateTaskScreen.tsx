import React, { useState } from "react"
import { View } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { Button } from "@/components/Button"
import { useAudioRecorder } from "@/hooks/useAudioRecorder"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { OolshikApi } from "@/api/client"
import * as FileSystem from "expo-file-system"

export default function CreateTaskScreen({ navigation }: any) {
  const [desc, setDesc] = useState("")
  const [radiusKm, setRadiusKm] = useState<1 | 2 | 5>(1)
  const { uri, start, stop, recording, durationSec, reset } = useAudioRecorder(30)
  const { coords } = useForegroundLocation()

  const uploadAndCreate = async () => {
    if (!coords) return alert("No location yet")
    if (!uri) return alert("Please record audio")
    const presigned = await OolshikApi.getPresigned("audio/m4a")
    if (!presigned.ok || !presigned.data) return alert("Upload URL error")
    const { uploadUrl, fileUrl } = presigned.data
    const file = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const resp = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "audio/m4a" },
      body: Buffer.from(file, "base64"),
    })
    if (resp.status >= 200 && resp.status < 300) {
      const res = await OolshikApi.createTask({
        voiceUrl: fileUrl,
        description: desc || undefined,
        lat: coords.latitude,
        lng: coords.longitude,
        radiusKm,
      })
      if (res.ok) {
        reset()
        navigation.goBack()
      } else {
        alert("Create failed")
      }
    } else {
      alert("Upload failed")
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
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button text="1 km" onPress={() => setRadiusKm(1)} />
        <Button text="2 km" onPress={() => setRadiusKm(2)} />
        <Button text="5 km" onPress={() => setRadiusKm(5)} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {!recording && <Button text="Record ≤30s" onPress={start} />}
        {recording && <Button text={`Stop (${durationSec}s)`} onPress={stop} />}
      </View>
      <Button text="Post" onPress={uploadAndCreate} />
    </Screen>
  )
}
