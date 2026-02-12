import React, { useMemo, useState } from "react"
import { Alert, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRoute } from "@react-navigation/native"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { TextField } from "@/components/TextField"
import { RadioGroup } from "@/components/RadioGroup"
import { Switch } from "@/components/Toggle/Switch"
import { useAppTheme } from "@/theme/context"
import { submitFeedback } from "@/features/feedback/storage/feedbackQueue"

const MAX_DESC = 500

type Params = { taskId?: string }

type BugCategory = "CRASH" | "SLOW" | "UI" | "LOGIN" | "TASK" | "OTHER"

export default function BugFeedbackScreen({ navigation }: { navigation: any }) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { params } = useRoute<any>() as { params?: Params }
  const { t } = useTranslation()

  const [category, setCategory] = useState<BugCategory>("CRASH")
  const [desc, setDesc] = useState("")
  const [includeDeviceInfo, setIncludeDeviceInfo] = useState(true)
  const [loading, setLoading] = useState(false)

  const options = useMemo(
    () => [
      { label: t("oolshik:feedback.bugCrash"), value: "CRASH" },
      { label: t("oolshik:feedback.bugSlow"), value: "SLOW" },
      { label: t("oolshik:feedback.bugUi"), value: "UI" },
      { label: t("oolshik:feedback.bugLogin"), value: "LOGIN" },
      { label: t("oolshik:feedback.bugTask"), value: "TASK" },
      { label: t("oolshik:feedback.bugOther"), value: "OTHER" },
    ],
    [t],
  )

  const onSubmit = async () => {
    if (loading) return
    setLoading(true)
    const trimmed = desc.trim().slice(0, MAX_DESC)

    const res = await submitFeedback({
      feedbackType: "BUG",
      contextType: params?.taskId ? "TASK" : "APP",
      contextId: params?.taskId,
      tags: [`category:${category}`],
      message: trimmed || undefined,
      includeDeviceInfo,
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
      <Text preset="heading" tx="oolshik:feedback.reportBug" />

      <View style={{ gap: spacing.xs }}>
        <Text tx="oolshik:feedback.bugCategory" weight="medium" />
        <RadioGroup
          value={category}
          onChange={(v) => setCategory(v as BugCategory)}
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

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.separator,
        }}
      >
        <View style={{ flex: 1, paddingRight: spacing.md }}>
          <Text tx="oolshik:feedback.includeDeviceInfo" weight="medium" />
          <Text
            tx="oolshik:feedback.includeDeviceInfoHint"
            size="xs"
            style={{ color: colors.textDim }}
          />
        </View>
        <Switch value={includeDeviceInfo} onValueChange={setIncludeDeviceInfo} />
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
