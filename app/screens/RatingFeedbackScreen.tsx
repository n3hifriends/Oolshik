import React, { useMemo, useState } from "react"
import { Alert, Pressable, View } from "react-native"
import { useTranslation } from "react-i18next"
import { useRoute } from "@react-navigation/native"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { TextField } from "@/components/TextField"
import { SmileySlider } from "@/components/SmileySlider"
import { useAppTheme } from "@/theme/context"
import { submitFeedback } from "@/features/feedback/storage/feedbackQueue"

const MAX_DESC = 300

type Params = { taskId?: string }

export default function RatingFeedbackScreen({ navigation }: { navigation: any }) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { params } = useRoute<any>() as { params?: Params }
  const { t } = useTranslation()

  const [rating, setRating] = useState(4)
  const [desc, setDesc] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const tagOptions = useMemo(
    () => [
      t("oolshik:feedback.tagTooSlow"),
      t("oolshik:feedback.tagConfusing"),
      t("oolshik:feedback.tagHelpful"),
      t("oolshik:feedback.tagGreatUi"),
    ],
    [t],
  )

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  const onSubmit = async () => {
    if (loading) return
    setLoading(true)

    const cleanRating = Math.max(1, Math.min(5, Math.round(rating)))
    const trimmed = desc.trim().slice(0, MAX_DESC)

    const res = await submitFeedback({
      feedbackType: "CSAT",
      contextType: params?.taskId ? "TASK" : "APP",
      contextId: params?.taskId,
      rating: cleanRating,
      tags,
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

  const TagChip = ({ label, active }: { label: string; active?: boolean }) => (
    <Pressable
      onPress={() => toggleTag(label)}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? colors.palette.primary500 : colors.palette.neutral300,
        backgroundColor: active ? colors.palette.primary100 : colors.palette.neutral100,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        text={label}
        size="xs"
        style={{ color: active ? colors.palette.primary700 : colors.text }}
      />
    </Pressable>
  )

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
    >
      <Text preset="heading" tx="oolshik:feedback.rateApp" />

      <View style={{ gap: spacing.sm }}>
        <Text tx="oolshik:feedback.ratingPrompt" weight="medium" />
        <SmileySlider value={rating} onChange={setRating} />
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text tx="oolshik:feedback.quickTags" weight="medium" />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.xs }}>
          {tagOptions.map((tag) => (
            <TagChip key={tag} label={tag} active={tags.includes(tag)} />
          ))}
        </View>
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text tx="oolshik:feedback.detailsOptional" weight="medium" />
        <TextField
          multiline
          numberOfLines={4}
          value={desc}
          onChangeText={(t) => setDesc(t.slice(0, MAX_DESC))}
          placeholderTx="oolshik:descriptionOptional"
          editable={!loading}
          style={{ minHeight: 100 }}
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
