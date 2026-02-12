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

type FeatureCategory = "SEARCH" | "TASKS" | "PAYMENTS" | "CHAT" | "PROFILE" | "OTHER"

type Priority = "NICE" | "IMPORTANT" | "URGENT"

export default function FeatureFeedbackScreen({ navigation }: { navigation: any }) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { params } = useRoute<any>() as { params?: Params }
  const { t } = useTranslation()

  const [category, setCategory] = useState<FeatureCategory>("SEARCH")
  const [priority, setPriority] = useState<Priority>("NICE")
  const [desc, setDesc] = useState("")
  const [loading, setLoading] = useState(false)

  const categories = useMemo(
    () => [
      { label: t("oolshik:feedback.featureSearch"), value: "SEARCH" },
      { label: t("oolshik:feedback.featureTasks"), value: "TASKS" },
      { label: t("oolshik:feedback.featurePayments"), value: "PAYMENTS" },
      { label: t("oolshik:feedback.featureChat"), value: "CHAT" },
      { label: t("oolshik:feedback.featureProfile"), value: "PROFILE" },
      { label: t("oolshik:feedback.featureOther"), value: "OTHER" },
    ],
    [t],
  )

  const priorities = useMemo(
    () => [
      { label: t("oolshik:feedback.priorityNice"), value: "NICE" },
      { label: t("oolshik:feedback.priorityImportant"), value: "IMPORTANT" },
      { label: t("oolshik:feedback.priorityUrgent"), value: "URGENT" },
    ],
    [t],
  )

  const onSubmit = async () => {
    if (loading) return
    setLoading(true)
    const trimmed = desc.trim().slice(0, MAX_DESC)

    const res = await submitFeedback({
      feedbackType: "FEATURE",
      contextType: params?.taskId ? "TASK" : "APP",
      contextId: params?.taskId,
      tags: [`category:${category}`, `priority:${priority}`],
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
      <Text preset="heading" tx="oolshik:feedback.suggestFeature" />

      <View style={{ gap: spacing.xs }}>
        <Text tx="oolshik:feedback.featureCategory" weight="medium" />
        <RadioGroup
          value={category}
          onChange={(v) => setCategory(v as FeatureCategory)}
          options={categories}
          wrap
        />
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text tx="oolshik:feedback.priority" weight="medium" />
        <RadioGroup
          value={priority}
          onChange={(v) => setPriority(v as Priority)}
          options={priorities}
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
