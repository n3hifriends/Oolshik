import React, { useEffect } from "react"
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import { useSafeAreaInsetsStyle } from "@/utils/useSafeAreaInsetsStyle"

export type PermissionsInfoSheetProps = {
  visible: boolean
  onDismiss: () => void
}

export function PermissionsInfoSheet({ visible, onDismiss }: PermissionsInfoSheetProps) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { t } = useTranslation()

  const $bottomInset = useSafeAreaInsetsStyle(["bottom"])

  const scrim = theme.isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.4)"

  useEffect(() => {
    if (visible && Platform.OS === "android") {
      AccessibilityInfo.announceForAccessibility?.(t("oolshik:consent.permissions.sheetTitle"))
    }
  }, [visible, t])

  const sections: Array<{ title: string; body: string; example: string }> = [
    {
      title: t("oolshik:consent.permissions.locationTitle"),
      body: t("oolshik:consent.permissions.locationBody"),
      example: t("oolshik:consent.permissions.locationExample"),
    },
    {
      title: t("oolshik:consent.permissions.notificationsTitle"),
      body: t("oolshik:consent.permissions.notificationsBody"),
      example: t("oolshik:consent.permissions.notificationsExample"),
    },
    {
      title: t("oolshik:consent.permissions.microphoneTitle"),
      body: t("oolshik:consent.permissions.microphoneBody"),
      example: t("oolshik:consent.permissions.microphoneExample"),
    },
    {
      title: t("oolshik:consent.permissions.cameraTitle"),
      body: t("oolshik:consent.permissions.cameraBody"),
      example: t("oolshik:consent.permissions.cameraExample"),
    },
  ]

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: scrim }}
          onPress={onDismiss}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
        <View
          accessibilityViewIsModal
          style={{
            maxHeight: "78%",
            backgroundColor: colors.surface,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            ...$bottomInset,
          }}
        >
          <View
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 999,
              backgroundColor: colors.palette.neutral400,
              marginBottom: spacing.sm,
            }}
          />

          <Text
            preset="heading"
            text={t("oolshik:consent.permissions.sheetTitle")}
            accessibilityRole="header"
            style={{ marginBottom: spacing.sm }}
          />

          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingBottom: spacing.sm }}
            showsVerticalScrollIndicator={false}
          >
            {sections.map((section, i) => (
              <View key={i} style={{ marginBottom: spacing.md }}>
                <Text text={section.title} weight="bold" size="sm" />
                <Text
                  text={section.body}
                  size="xs"
                  style={{ color: colors.text, marginTop: spacing.xxxs }}
                />
                <Text
                  text={section.example}
                  size="xxs"
                  style={{ color: colors.textDim, marginTop: spacing.xxxs }}
                />
              </View>
            ))}

            <Text
              text={t("oolshik:consent.permissions.privacyNote")}
              size="xxs"
              style={{ color: colors.textDim }}
            />
          </ScrollView>

          <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.sm }}>
            <Button text={t("oolshik:consent.permissions.gotIt")} onPress={onDismiss} />
          </View>
        </View>
      </View>
    </Modal>
  )
}
