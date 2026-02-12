import React, { useMemo, useState } from "react"
import { Alert, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRoute } from "@react-navigation/native"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { TextField } from "@/components/TextField"
import { RadioGroup } from "@/components/RadioGroup"
import { useAppTheme } from "@/theme/context"
import { submitFeedback } from "@/features/feedback/storage/feedbackQueue"

const MAX_DESC = 500

type Params = { taskId?: string }

type SafetyCategory = "UNSAFE" | "HARASSMENT" | "SCAM" | "OTHER"

export default function SafetyFeedbackScreen({ navigation }: { navigation: any }) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { params } = useRoute<any>() as { params?: Params }
  const { t } = useTranslation()

  const [category, setCategory] = useState<SafetyCategory>("UNSAFE")
  const [desc, setDesc] = useState("")
  const [loading, setLoading] = useState(false)

  const options = useMemo(
    () => [
      { label: t("oolshik:feedback.safetyUnsafe"), value: "UNSAFE" },
      { label: t("oolshik:feedback.safetyHarassment"), value: "HARASSMENT" },
      { label: t("oolshik:feedback.safetyScam"), value: "SCAM" },
      { label: t("oolshik:feedback.bugOther"), value: "OTHER" },
    ],
    [t],
  )

  const onSubmit = async () => {
    if (loading) return

    const trimmed = desc.trim().slice(0, MAX_DESC)
    if (category === "OTHER" && !trimmed) {
      Alert.alert(t("oolshik:feedback.addDetails"))
      return
    }

    setLoading(true)
    const res = await submitFeedback({
      feedbackType: "SAFETY",
      contextType: params?.taskId ? "TASK" : "APP",
      contextId: params?.taskId,
      tags: [`category:${category}`],
      message: trimmed || undefined,
    })
    setLoading(false)

    if (res.ok) {
      Alert.alert(t("oolshik:feedback.thanks"))
      navigation.goBack()
      return
    }

    if (res.queued) {
      Alert.alert(t("oolshik:feedback.queued"))
      navigation.goBack()
      return
    }

    Alert.alert(t("oolshik:feedback.error"))
  }

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
    >
      <Text preset="heading" tx="oolshik:feedback.safetyConcern" />

      <View style={{ gap: spacing.xs }}>
        <Text tx="oolshik:feedback.safetyCategory" weight="medium" />
        <RadioGroup
          value={category}
          onChange={(v) => setCategory(v as SafetyCategory)}
          options={options}
          wrap
        />
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text tx="oolshik:feedback.detailsOptional" weight="medium" />
        <TextField
          multiline
          numberOfLines={6}
          value={desc}
          onChangeText={(t) => setDesc(t.slice(0, MAX_DESC))}
          placeholderTx="oolshik:descriptionOptional"
          editable={!loading}
          style={{ minHeight: 120 }}
        />
        <Text
          text={`${desc.length}/${MAX_DESC}`}
          size="xs"
          style={{ color: colors.textDim, alignSelf: "flex-end" }}
        />
      </View>

      <Button
        text={loading ? t("oolshik:feedback.submitting") : t("oolshik:feedback.submit")}
        onPress={onSubmit}
        disabled={loading}
        style={{ paddingVertical: spacing.xs }}
      />
    </Screen>
  )
}
