// app/screens/ReportScreen.tsx
import React from "react"
import { View, Alert, Pressable } from "react-native"
import { useTranslation } from "react-i18next"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { TextField } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"
import { OolshikApi } from "@/api"
import { useRoute, useNavigation } from "@react-navigation/native"
import { breadcrumb } from "@/utils/crashReporting"

type Params = { taskId?: string; userId?: string; targetUserId?: string }

type Reason = "SPAM" | "INAPPROPRIATE" | "UNSAFE" | "OTHER" | "CHILD_SAFETY"

export default function ReportScreen() {
  const { t } = useTranslation()
  const nav = useNavigation<any>()
  const { params } = useRoute<any>() as { params: Params }
  const { theme } = useAppTheme()
  const { spacing, colors, isDark } = theme

  const [reason, setReason] = React.useState<Reason>("UNSAFE")
  const [text, setText] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const MAX_DESC = 500

  const validate = (): { ok: boolean; message?: string } => {
    const targetUserId = params?.targetUserId || params?.userId
    if (!params?.taskId && !targetUserId) {
      return { ok: false, message: t("oolshik:reportScreen.missingContext") }
    }
    if (reason === "OTHER" && !text.trim()) {
      return { ok: false, message: t("oolshik:reportScreen.addDetailsForOther") }
    }
    if (reason === "CHILD_SAFETY" && !text.trim()) {
      return { ok: false, message: t("oolshik:reportScreen.addDetailsForChildSafety") }
    }
    if (text.length > 1000) {
      return { ok: false, message: t("oolshik:reportScreen.detailsTooLong") }
    }
    return { ok: true }
  }

  const submit = async () => {
    const v = validate()
    if (!v.ok) {
      Alert.alert(t("oolshik:reportScreen.reportTitle"), v.message)
      return
    }

    breadcrumb(`task:report_submitted reason=${reason.toLowerCase()}`)
    setLoading(true)
    try {
      const targetUserId = params?.targetUserId || params?.userId
      const res = await OolshikApi.report({
        taskId: params?.taskId,
        targetUserId: targetUserId,
        reason,
        text: text.trim() || undefined,
      })

      if (res?.ok) {
        breadcrumb(`task:report_success reason=${reason.toLowerCase()}`)
        Alert.alert(t("oolshik:reportScreen.thanksTitle"), t("oolshik:reportScreen.thanksBody"))
        nav.goBack()
      } else {
        breadcrumb(`task:report_failed reason=${reason.toLowerCase()} kind=api_error`)
        const message =
          (res?.data as any)?.message ?? (res as any)?.problem ?? t("oolshik:homeScreen.tryAgain")
        Alert.alert(t("oolshik:reportScreen.failedTitle"), message)
      }
    } catch (e: any) {
      breadcrumb(`task:report_failed reason=${reason.toLowerCase()} kind=exception`)
      Alert.alert(t("oolshik:reportScreen.failedTitle"), e?.message ?? t("oolshik:homeScreen.tryAgain"))
    } finally {
      setLoading(false)
    }
  }

  const reasons = [
    { label: t("oolshik:reportScreen.unsafe"), value: "UNSAFE" },
    { label: t("oolshik:reportScreen.childSafety"), value: "CHILD_SAFETY" },
    { label: t("oolshik:reportScreen.inappropriate"), value: "INAPPROPRIATE" },
    { label: t("oolshik:reportScreen.spam"), value: "SPAM" },
    { label: t("oolshik:reportScreen.other"), value: "OTHER" },
  ]

  const detailsRequired = reason === "CHILD_SAFETY" || reason === "OTHER"
  const detailsLabel = detailsRequired
    ? t("oolshik:reportScreen.detailsRequired")
    : t("oolshik:reportScreen.detailsOptional")
  const detailsPlaceholder = reason === "CHILD_SAFETY"
    ? t("oolshik:reportScreen.placeholderChildSafety")
    : t("oolshik:reportScreen.placeholder")
  const activeBg = isDark ? colors.tint : "#111827"
  const inactiveBg = isDark ? colors.separator : "#F2F4F7"
  const activeText = isDark ? colors.background : "#fff"
  const inactiveText = colors.text

  const Pill: React.FC<{
    label: string
    active?: boolean
    onPress?: () => void
    dotColor?: string
  }> = ({ label, active, onPress, dotColor = "#FF6B2C" }) => (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        backgroundColor: active ? activeBg : inactiveBg,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: active ? activeText : dotColor,
          opacity: active ? 1 : 0.8,
        }}
      />
      <Text style={{ color: active ? activeText : inactiveText, fontWeight: "600" }} text={label} />
    </Pressable>
  )
  return (
    <Screen
      preset="fixed"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ padding: 16 }}
    >
      <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ alignSelf: "flex-start", marginBottom: 8 }} accessibilityRole="button">
        <Text text={`← ${t("common:back")}`} />
      </Pressable>

      <Text preset="heading" text={t("oolshik:reportScreen.heading")} />
      <View style={{ height: spacing.md }} />

      <Text text={t("oolshik:reportScreen.reason")} weight="medium" />
      <View style={{ height: spacing.xs }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {reasons.map((r) => (
          <Pill
            key={r.value}
            label={r.label}
            active={reason === r.value}
            onPress={() => setReason(r.value as Reason)}
          />
        ))}
      </View>

      <View style={{ height: spacing.md }} />
      <Text text={detailsLabel} weight="medium" />
      <View style={{ height: spacing.xs }} />
      <TextField
        multiline
        numberOfLines={6}
        value={text}
        onChangeText={(t) => setText(t.slice(0, MAX_DESC))}
        placeholder={detailsPlaceholder}
        style={{ minHeight: 120 }}
        editable={!loading}
      />
      <Text
        style={{ alignSelf: "flex-end", color: colors.textDim, marginTop: 4 }}
      >{`${text.length}/${MAX_DESC}`}</Text>

      <View style={{ height: spacing.lg }} />
      <Button
        text={loading ? t("oolshik:reportScreen.submitting") : t("oolshik:reportScreen.submit")}
        onPress={submit}
        disabled={loading}
        style={{ width: "100%", paddingVertical: spacing.xs }}
      />
    </Screen>
  )
}
