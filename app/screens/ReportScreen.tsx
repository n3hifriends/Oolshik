// app/screens/ReportScreen.tsx
import React from "react"
import { View } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { TextField } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"
import { OolshikApi } from "@/api"
import { useRoute, useNavigation } from "@react-navigation/native"
import { RadioGroup } from "@/components/RadioGroup"

type Params = { taskId?: string; userId?: string }

export default function ReportScreen() {
  const nav = useNavigation<any>()
  const { params } = useRoute<any>() as { params: Params }
  const { theme } = useAppTheme()
  const { spacing, colors } = theme

  const [reason, setReason] = React.useState<"SPAM" | "INAPPROPRIATE" | "UNSAFE" | "OTHER">("SPAM")
  const [text, setText] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const submit = async () => {
    setLoading(true)
    try {
      const res = await OolshikApi.report({
        taskId: params?.taskId,
        targetUserId: params?.userId,
        reason,
        text: text.trim() || undefined,
      })
      if (res?.ok) {
        nav.goBack()
      } else {
        alert("Report failed")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen
      preset="fixed"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ padding: 16 }}
    >
      <Text preset="heading" text="Report" />
      <View style={{ height: spacing.md }} />

      <Text text="Reason" weight="medium" />
      <View style={{ height: spacing.xs }} />
      <RadioGroup
        value={reason}
        onChange={(v) => setReason(v as any)}
        options={[
          { label: "Spam / Advertising", value: "SPAM" },
          { label: "Inappropriate Content", value: "INAPPROPRIATE" },
          { label: "Unsafe / Harmful", value: "UNSAFE" },
          { label: "Other", value: "OTHER" },
        ]}
        gap={8}
        wrap
      />

      <View style={{ height: spacing.md }} />
      <Text text="Details (optional)" weight="medium" />
      <View style={{ height: spacing.xs }} />
      <TextField
        multiline
        numberOfLines={6}
        value={text}
        onChangeText={setText}
        placeholder="Describe the issue…"
        style={{ minHeight: 120 }}
      />

      <View style={{ height: spacing.lg }} />
      <Button
        text={loading ? "Submitting…" : "Submit Report"}
        onPress={submit}
        disabled={loading}
        style={{ width: "100%", paddingVertical: spacing.xs }}
      />
    </Screen>
  )
}
