import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Linking, Modal, Pressable, ScrollView, View } from "react-native"
import { useTranslation } from "react-i18next"
import * as Application from "expo-application"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { SectionCard } from "@/components/SectionCard"
import { RadioGroup } from "@/components/RadioGroup"
import { Switch } from "@/components/Toggle/Switch"
import { useAppTheme } from "@/theme/context"
import { useAuth } from "@/context/AuthContext"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { OolshikApi } from "@/api"
import { disablePushNotifications, enablePushNotifications } from "@/utils/pushNotifications"
import type { ProfileExtras } from "@/features/profile/types"
import {
  getProfileExtras,
  updateProfileExtras,
} from "@/features/profile/storage/profileExtrasStore"

const SUPPORT_EMAIL = "support@oolshik.in"

function getInitials(name?: string, fallback?: string) {
  const source = (name || fallback || "").trim()
  if (!source) return "U"
  const parts = source.split(/[\s@._-]+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase()
}

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { i18n } = useTranslation()
  const { logout, userName, authEmail, userId } = useAuth()
  const { status: locationStatus } = useForegroundLocation({ autoRequest: false })

  const [extras, setExtras] = useState<ProfileExtras>({})
  const [stats, setStats] = useState<{ avgRating?: number | null; completedHelps?: number | null }>(
    {},
  )
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [showSafetyTips, setShowSafetyTips] = useState(false)

  useEffect(() => {
    let active = true
    getProfileExtras().then((data) => {
      if (!active) return
      const next = data ?? {}
      setExtras(next)

      const storedLang = next.language
      const currentLang = i18n.language.split("-")[0]
      if (storedLang && storedLang !== currentLang) {
        i18n.changeLanguage(storedLang)
      }
    })

    return () => {
      active = false
    }
  }, [i18n])

  const applyExtras = useCallback(async (patch: Partial<ProfileExtras>) => {
    const next = await updateProfileExtras(patch)
    setExtras(next)
  }, [])

  const authName = userName && userName !== "You" ? userName : undefined
  const nameToShow = authName || extras.fullNameOverride || "Set your name"
  const showSetNameCta = !authName && !extras.fullNameOverride
  const identifier = authEmail || "—"
  const initials = getInitials(authName || extras.fullNameOverride, authEmail)

  const languageValue = useMemo(() => {
    const current = extras.language ?? i18n.language.split("-")[0]
    return current === "mr" ? "mr" : "en"
  }, [extras.language, i18n.language])

  const notificationsEnabled = extras.notificationsEnabled ?? true

  const locationLabel = useMemo(() => {
    if (locationStatus === "ready") return "Enabled"
    if (locationStatus === "denied") return "Denied"
    if (locationStatus === "error") return "Error"
    if (locationStatus === "loading") return "Checking"
    return "Unknown"
  }, [locationStatus])

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings()
    } catch {
      Alert.alert("Unable to open settings")
    }
  }, [])

  const onReportIssue = useCallback(async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Oolshik Support")}`
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (!canOpen) throw new Error("Cannot open mail app")
      await Linking.openURL(url)
    } catch {
      Alert.alert("Unable to open mail app", `Email us at ${SUPPORT_EMAIL}`)
    }
  }, [])

  const onLanguageChange = useCallback(
    async (lang: "mr" | "en") => {
      i18n.changeLanguage(lang)
      await applyExtras({ language: lang })
    },
    [applyExtras, i18n],
  )

  const onToggleNotifications = useCallback(
    async (value: boolean) => {
      await applyExtras({ notificationsEnabled: value })
      try {
        if (value) {
          await enablePushNotifications()
        } else {
          await disablePushNotifications()
        }
      } catch {
        // best-effort
      }
    },
    [applyExtras],
  )

  useEffect(() => {
    let active = true
    OolshikApi.getMyStats()
      .then((res) => {
        if (!active) return
        if (res.ok && res.data) setStats(res.data)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const ratingText = stats?.avgRating != null ? stats.avgRating.toFixed(1) : "—"
  const completedText = stats?.completedHelps != null ? String(stats.completedHelps) : "—"

  const appVersion = Application.nativeApplicationVersion ?? "—"
  const buildVersion = Application.nativeBuildVersion
  const versionLabel = buildVersion ? `${appVersion} (${buildVersion})` : appVersion

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
    >
      <Text preset="heading" text="Profile" />

      <SectionCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.palette.primary200,
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityLabel="Profile avatar"
          >
            <Text text={initials} style={{ fontSize: 20, fontWeight: "700" }} />
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Text
              preset="heading"
              text={nameToShow}
              style={showSetNameCta ? { color: colors.palette.primary600 } : undefined}
            />
            <Text text={identifier} size="xs" style={{ color: colors.textDim }} />
            <Text text="Verification: Done" size="xxs" style={{ color: colors.textDim }} />
          </View>
        </View>

        {showSetNameCta ? (
          <View style={{ marginTop: spacing.md }}>
            <Button
              text="Set your name"
              onPress={() => navigation.navigate("OolshikProfileEdit")}
              style={{ borderRadius: 10, minHeight: 44 }}
              accessibilityLabel="Set your name"
            />
          </View>
        ) : null}

        <Pressable
          onPress={() => setAdvancedOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel="Advanced profile details"
          style={{
            marginTop: spacing.md,
            paddingTop: spacing.md,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text text="Advanced" weight="medium" />
          <Text text={advancedOpen ? "Hide" : "Show"} size="xs" />
        </Pressable>

        {advancedOpen ? (
          <View style={{ marginTop: spacing.sm }}>
            <Text text={`User ID: ${userId ?? "—"}`} size="xs" style={{ color: colors.textDim }} />
          </View>
        ) : null}
      </SectionCard>

      <SectionCard>
        <Text preset="subheading" text="Trust & Safety" style={{ marginBottom: spacing.sm }} />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text text="Rating" size="xs" style={{ color: colors.textDim }} />
            <Text text={ratingText} weight="medium" />
          </View>
          <View style={{ flex: 1 }}>
            <Text text="Completed helps" size="xs" style={{ color: colors.textDim }} />
            <Text text={completedText} weight="medium" />
          </View>
        </View>

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Button
            text="Safety tips"
            onPress={() => setShowSafetyTips(true)}
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel="Safety tips"
          />
          <Button
            text="Report an issue"
            onPress={onReportIssue}
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel="Report an issue"
          />
        </View>
      </SectionCard>

      <SectionCard>
        <Text preset="subheading" text="Preferences" style={{ marginBottom: spacing.sm }} />

        <View style={{ gap: spacing.sm }}>
          <Text text="Language" size="xs" style={{ color: colors.textDim }} />
          <RadioGroup
            value={languageValue}
            onChange={(v) => onLanguageChange(v as "mr" | "en")}
            options={[
              { label: "मराठी", value: "mr" },
              { label: "English", value: "en" },
            ]}
          />
        </View>

        <View
          style={{
            marginTop: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text text="Notifications" weight="medium" />
            <Text text="Local-only toggle" size="xs" style={{ color: colors.textDim }} />
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={onToggleNotifications}
            accessibilityLabel="Notifications toggle"
          />
        </View>

        <View
          style={{
            marginTop: spacing.lg,
            paddingTop: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.separator,
            gap: spacing.sm,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text text="Location permission" weight="medium" />
            <Text text={locationLabel} size="xs" style={{ color: colors.textDim }} />
          </View>
          <Button
            text="Open Settings"
            onPress={openSettings}
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel="Open settings"
          />
        </View>
      </SectionCard>

      <SectionCard>
        <Text preset="subheading" text="Account" style={{ marginBottom: spacing.sm }} />
        <View style={{ marginBottom: spacing.sm }}>
          <Text text="App version" size="xs" style={{ color: colors.textDim }} />
          <Text text={versionLabel} weight="medium" />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Button
            text="Edit Profile"
            onPress={() => navigation.navigate("OolshikProfileEdit")}
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel="Edit profile"
          />
          <Button
            text="Logout"
            onPress={logout}
            style={{
              borderRadius: 10,
              minHeight: 44,
              backgroundColor: colors.error,
              borderWidth: 0,
            }}
            textStyle={{ color: colors.palette.neutral100 }}
            accessibilityLabel="Logout"
          />
          <Button
            text="Delete account (coming soon)"
            disabled
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel="Delete account"
          />
        </View>
      </SectionCard>

      <Modal visible={showSafetyTips} animationType="slide" transparent>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
        >
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: spacing.lg,
              maxHeight: "80%",
            }}
          >
            <Text preset="heading" text="Safety tips" />
            <ScrollView style={{ marginTop: spacing.md }}>
              {[
                "Verify task details before accepting.",
                "Use in-app chat and avoid sharing sensitive info.",
                "Meet in public places when possible.",
                "Report suspicious behavior immediately.",
              ].map((tip) => (
                <View key={tip} style={{ marginBottom: spacing.sm }}>
                  <Text text={`• ${tip}`} />
                </View>
              ))}
            </ScrollView>
            <View style={{ marginTop: spacing.md }}>
              <Button
                text="Close"
                onPress={() => setShowSafetyTips(false)}
                style={{ borderRadius: 10, minHeight: 44 }}
                accessibilityLabel="Close safety tips"
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}
