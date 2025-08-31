// app/audio/AudioCaptureScreen.tsx
// Uses your design system components from '@/components'
import React, { useEffect, useState } from "react"
import { View, Alert, FlatList } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import RNFS from "react-native-fs"
// Choose one import based on your stack; RN default is .rn.ts
import { useAudioRecorder } from "./useAudioRecorder"
import { initUpload, uploadChunk, completeUpload, listMyRecordings, deleteRecording, streamUrl } from "@/app/api/audio"

const CHUNK_SIZE = 5 * 1024 * 1024

function b64ToBytes(b64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  let bytes: number[] = []
  let i = 0
  b64 = b64.replace(/[^A-Za-z0-9\+\/\=]/g, '')
  while (i < b64.length) {
    const enc1 = chars.indexOf(b64.charAt(i++))
    const enc2 = chars.indexOf(b64.charAt(i++))
    const enc3 = chars.indexOf(b64.charAt(i++))
    const enc4 = chars.indexOf(b64.charAt(i++))
    const chr1 = (enc1 << 2) | (enc2 >> 4)
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2)
    const chr3 = ((enc3 & 3) << 6) | enc4
    bytes.push(chr1)
    if (enc3 !== 64) bytes.push(chr2)
    if (enc4 !== 64) bytes.push(chr3)
  }
  return Uint8Array.from(bytes)
}

export default function AudioCaptureScreen() {
  const { state, start, pause, resume, stop, durationMs, path } = useAudioRecorder()
  const [uploading, setUploading] = useState(false)
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    const res = await listMyRecordings()
    if (res.ok) setItems(res.data as any[])
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  const handleUpload = async () => {
    if (!path) return
    try {
      setUploading(true)
      const stat = await RNFS.stat(path)
      const size = Number(stat.size)
      const filename = path.split("/").pop() || `recording_${Date.now()}.m4a`
      const init = await initUpload({ filename, mimeType: "audio/m4a", size })
      if (!init.ok || !init.data) throw new Error("Failed to init upload")
      const uploadId = (init.data as any).uploadId

      let offset = 0, index = 0
      while (offset < size) {
        const length = Math.min(CHUNK_SIZE, size - offset)
        const base64 = await RNFS.read(path, length, offset, "base64")
        const bytes = b64ToBytes(base64)
        const res = await uploadChunk(uploadId, index, bytes)
        if (!res.ok) throw new Error(`Chunk ${index} failed`)
        offset += length; index++
      }
      const comp = await completeUpload({ uploadId, totalChunks: index, durationMs })
      if (!comp.ok) throw new Error("Complete failed")
      Alert.alert("Uploaded", "Your audio has been uploaded.")
      refresh()
    } catch (e:any) {
      Alert.alert("Upload error", e.message || "Unknown error")
    } finally {
      setUploading(false)
    }
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top"]} contentContainerStyle={{ padding: 16 }}>
      <Text preset="heading">Record audio</Text>
      <Text style={{ marginTop: 4 }}>Status: {state} | Duration: {(durationMs/1000).toFixed(1)}s</Text>
      <View style={{ flexDirection: "row", marginVertical: 12 }}>
        <Button text="Start" onPress={start} style={{ marginRight: 8 }} />
        <Button text="Pause" onPress={pause} style={{ marginRight: 8 }} />
        <Button text="Resume" onPress={resume} style={{ marginRight: 8 }} />
        <Button text="Stop" onPress={async () => { await stop() }} />
      </View>
      <Button text={uploading ? "Uploading..." : "Upload"} onPress={handleUpload} disabled={!path || uploading} />
      <Text preset="subheading" style={{ marginTop: 16 }}>My recordings</Text>
      {loading ? <Text>Loading...</Text> :
        <FlatList
          data={items}
          keyExtractor={(it) => it.id}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ flex: 1 }} numberOfLines={1}>{item.filename}</Text>
              <Button text="Play" onPress={() => { /* Your global audio player can consume streamUrl(item.id) */ }} style={{ marginRight: 8 }} />
              <Button text="Delete" onPress={async () => { const r = await deleteRecording(item.id); if (r.ok) refresh() }} />
            </View>
          )}
        />
      }
    </Screen>
  )
}