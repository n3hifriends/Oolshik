import React, { useState } from "react"
import { View } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import { Button } from "@/components/Button"
import { OolshikApi } from "@/api"

export default function ReportScreen() {
  const [reason, setReason] = useState("")
  const [text, setText] = useState("")
  const submit = async () => {
    if (!reason) return alert("Enter reason")
    const res = await OolshikApi.report({ reason, text: text || undefined })
    if (res.ok) alert("Reported")
    else alert("Failed")
  }
  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <Text preset="heading" text="Report" />
      <TextField value={reason} onChangeText={setReason} placeholder="Reason" />
      <TextField value={text} onChangeText={setText} placeholder="Details (optional)" multiline />
      <Button text="Submit" onPress={submit} />
    </Screen>
  )
}
