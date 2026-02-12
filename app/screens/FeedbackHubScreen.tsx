import React from "react"
import { Pressable, View } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { SectionCard } from "@/components/SectionCard"
import { useAppTheme } from "@/theme/context"
import { useRoute } from "@react-navigation/native"
import type { TxKeyPath } from "@/i18n"

type Params = { taskId?: string; targetUserId?: string }

export default function FeedbackHubScreen({ navigation }: { navigation: any }) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { params } = useRoute<any>() as { params?: Params }
  const taskId = params?.taskId
  const targetUserId = params?.targetUserId
  const canRouteToReport = !!taskId || !!targetUserId

  const Row = ({
    titleTx,
    subtitleTx,
    onPress,
  }: {
    titleTx: TxKeyPath
    subtitleTx?: TxKeyPath
    onPress: () => void
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1, paddingRight: spacing.sm }}>
        <Text tx={titleTx} weight="medium" />
        {subtitleTx ? <Text tx={subtitleTx} size="xs" style={{ color: colors.textDim }} /> : null}
      </View>
      <Text text=">" style={{ color: colors.textDim }} />
    </Pressable>
  )

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
    >
      <Text preset="heading" tx="oolshik:feedback.title" />
      <Text tx="oolshik:feedback.subtitle" size="xs" style={{ color: colors.textDim }} />

      <SectionCard>
        <Row
          titleTx="oolshik:feedback.reportBug"
          subtitleTx="oolshik:feedback.reportBugSubtitle"
          onPress={() => navigation.navigate("OolshikFeedbackBug", { taskId })}
        />
        <Row
          titleTx="oolshik:feedback.suggestFeature"
          subtitleTx="oolshik:feedback.suggestFeatureSubtitle"
          onPress={() => navigation.navigate("OolshikFeedbackFeature", { taskId })}
        />
        <Row
          titleTx="oolshik:feedback.rateApp"
          subtitleTx="oolshik:feedback.rateAppSubtitle"
          onPress={() => navigation.navigate("OolshikFeedbackRating", { taskId })}
        />
        <Row
          titleTx="oolshik:feedback.safetyConcern"
          subtitleTx="oolshik:feedback.safetyConcernSubtitle"
          onPress={() => {
            if (canRouteToReport) {
              navigation.navigate("OolshikReport", { taskId, targetUserId })
            } else {
              navigation.navigate("OolshikFeedbackSafety", {})
            }
          }}
        />
      </SectionCard>
    </Screen>
  )
}
