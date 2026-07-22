import React, { useCallback, useEffect, useMemo, useState } from "react"
import { Alert, Linking, Modal, Pressable, ScrollView, View } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { useTranslation } from "react-i18next"
import * as Application from "expo-application"
import Clipboard from "@react-native-clipboard/clipboard"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { SectionCard } from "@/components/SectionCard"
import { RadioGroup } from "@/components/RadioGroup"
import { useAppTheme } from "@/theme/context"
import { useAuth } from "@/context/AuthContext"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { OolshikApi } from "@/api"
import type { ProfileExtras } from "@/features/profile/types"
import {
  getProfileExtras,
  updateProfileExtras,
} from "@/features/profile/storage/profileExtrasStore"
import { fromLanguageCode, normalizeLocaleTag, toLanguageCode } from "@/i18n/locale"
import type { PaymentProfileApiResponse } from "@/api/client"
import { useRemoteConfig } from "@/services/remoteConfig"
import { useResponsiveLayout } from "@/utils/useResponsiveLayout"

const FALLBACK_supportEmail = "support@oolshik.in"

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
  const { scaleIcon } = useResponsiveLayout()
  const avatarSize = scaleIcon(64)
  const { t, i18n } = useTranslation()
  const { logout, userName, authEmail, userId } = useAuth()
  const { support_contact_email: remoteEmail, support_contact_whatsapp: remoteWhatsapp } =
    useRemoteConfig()
  const supportEmail = remoteEmail || FALLBACK_supportEmail
  const { status: locationStatus } = useForegroundLocation({ autoRequest: false })

  const [extras, setExtras] = useState<ProfileExtras>({})
  const [stats, setStats] = useState<{ avgRating?: number | null; completedHelps?: number | null }>(
    {},
  )
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [showSafetyTips, setShowSafetyTips] = useState(false)
  const [paymentProfile, setPaymentProfile] = useState<PaymentProfileApiResponse>({
    hasProfile: false,
  })

  useEffect(() => {
    let active = true
    getProfileExtras().then((data) => {
      if (!active) return
      const next = data ?? {}
      setExtras(next)

      const storedLang = next.preferredLanguage ?? next.language
      const currentLang = normalizeLocaleTag(i18n.language)
      if (storedLang && normalizeLocaleTag(storedLang) !== currentLang) {
        i18n.changeLanguage(normalizeLocaleTag(storedLang))
      }
    })

    return () => {
      active = false
    }
  }, [i18n])

  useFocusEffect(
    useCallback(() => {
      let active = true
      OolshikApi.getMyPaymentProfile()
        .then((response) => {
          if (!active) return
          if (response.ok && response.data) {
            setPaymentProfile(response.data)
          } else {
            setPaymentProfile({ hasProfile: false })
          }
        })
        .catch(() => {
          if (active) setPaymentProfile({ hasProfile: false })
        })
      return () => {
        active = false
      }
    }, []),
  )

  const applyExtras = useCallback(async (patch: Partial<ProfileExtras>) => {
    const next = await updateProfileExtras(patch)
    setExtras(next)
  }, [])

  const authName = userName && userName !== "You" ? userName : undefined
  const nameToShow = authName || extras.fullNameOverride || t("oolshik:profileScreen.setYourName")
  const showSetNameCta = !authName && !extras.fullNameOverride
  const identifier = authEmail || "—"
  const initials = getInitials(authName || extras.fullNameOverride, authEmail)

  const languageValue = useMemo(() => {
    const current = extras.preferredLanguage ?? extras.language ?? i18n.language
    return toLanguageCode(current)
  }, [extras.preferredLanguage, extras.language, i18n.language])

  const locationLabel = useMemo(() => {
    if (locationStatus === "ready") return t("oolshik:profileScreen.locationEnabled")
    if (locationStatus === "denied") return t("oolshik:profileScreen.locationDenied")
    if (locationStatus === "error") return t("oolshik:profileScreen.locationError")
    if (locationStatus === "loading") return t("oolshik:profileScreen.locationChecking")
    return t("oolshik:profileScreen.locationUnknown")
  }, [locationStatus, t])

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings()
    } catch {
      Alert.alert(t("oolshik:profileScreen.settingsErrorTitle"))
    }
  }, [t])

  const onReportIssue = useCallback(async () => {
    const url = `mailto:${supportEmail}?subject=${encodeURIComponent(t("oolshik:profileScreen.mailSubject"))}`
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (!canOpen) throw new Error("Cannot open mail app")
      await Linking.openURL(url)
    } catch {
      Alert.alert(
        t("oolshik:profileScreen.mailOpenFailedTitle"),
        t("oolshik:profileScreen.mailOpenFailedBody", { email: supportEmail }),
        [
          { text: t("common:ok") },
          {
            text: t("oolshik:profileScreen.copyEmailButton"),
            onPress: () => {
              Clipboard.setString(supportEmail)
              setTimeout(() => {
                Alert.alert(t("oolshik:profileScreen.emailCopiedConfirmation"), supportEmail)
              }, 0)
            },
          },
        ],
      )
    }
  }, [t, supportEmail])

  const onContactWhatsApp = useCallback(async () => {
    const phone = remoteWhatsapp.replace(/\D/g, "")
    const url = `whatsapp://send?phone=${encodeURIComponent(phone)}`
    try {
      const canOpen = await Linking.canOpenURL(url)
      if (!canOpen) throw new Error("WhatsApp not available")
      await Linking.openURL(url)
    } catch {
      Alert.alert(
        t("oolshik:profileScreen.whatsappOpenFailedTitle"),
        t("oolshik:profileScreen.whatsappOpenFailedBody", { number: remoteWhatsapp }),
      )
    }
  }, [t, remoteWhatsapp])

  const onLanguageChange = useCallback(
    async (lang: "mr" | "en") => {
      const preferredLanguage = fromLanguageCode(lang)
      await i18n.changeLanguage(preferredLanguage)
      await applyExtras({ language: preferredLanguage, preferredLanguage })
      try {
        await OolshikApi.updatePreferredLanguage(preferredLanguage)
      } catch {
        // best-effort; local preference is already persisted
      }
    },
    [applyExtras, i18n],
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
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel={t("oolshik:editProfileScreen.back")}
        hitSlop={8}
        style={{ alignSelf: "flex-start" }}
      >
        <Text text={`← ${t("oolshik:editProfileScreen.back")}`} />
      </Pressable>

      <Text preset="heading" text={t("oolshik:profileScreen.heading")} />

      <SectionCard>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View
            style={{
              width: avatarSize,
              height: avatarSize,
              borderRadius: avatarSize / 2,
              backgroundColor: colors.palette.primary200,
              alignItems: "center",
              justifyContent: "center",
            }}
            accessibilityLabel={t("oolshik:profileScreen.avatarA11y")}
          >
            <Text text={initials} style={{ fontSize: 20, fontWeight: "700" }} />
          </View>

          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <Text
              preset="heading"
              text={nameToShow}
              style={showSetNameCta ? { color: colors.palette.primary600 } : undefined}
            />
            <Text text={identifier} size="xs" style={{ color: colors.textDim }} />
            <Text
              text={t("oolshik:profileScreen.verificationDone")}
              size="xxs"
              style={{ color: colors.textDim }}
            />
          </View>
        </View>

        {showSetNameCta ? (
          <View style={{ marginTop: spacing.md }}>
            <Button
              text={t("oolshik:profileScreen.setYourName")}
              onPress={() => navigation.navigate("OolshikProfileEdit")}
              style={{ borderRadius: 10, minHeight: 44 }}
              accessibilityLabel={t("oolshik:profileScreen.setYourNameA11y")}
            />
          </View>
        ) : null}

        <Pressable
          onPress={() => setAdvancedOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={t("oolshik:profileScreen.advancedA11y")}
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
          <Text text={t("oolshik:profileScreen.advanced")} weight="medium" />
          <Text
            text={advancedOpen ? t("oolshik:profileScreen.hide") : t("oolshik:profileScreen.show")}
            size="xs"
          />
        </Pressable>

        {advancedOpen ? (
          <View style={{ marginTop: spacing.sm }}>
            <Text
              text={t("oolshik:profileScreen.userId", { id: userId ?? "—" })}
              size="xs"
              style={{ color: colors.textDim }}
            />
          </View>
        ) : null}
      </SectionCard>

      <SectionCard>
        <Text
          preset="subheading"
          text={t("payment:profile.profileCardTitle")}
          style={{ marginBottom: spacing.sm }}
        />
        <Text
          text={t("payment:profile.profileCardBody")}
          size="xs"
          style={{ color: colors.textDim }}
        />
        <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
          <Text
            text={t("payment:profile.currentUpi")}
            size="xs"
            style={{ color: colors.textDim }}
          />
          <Text
            text={
              paymentProfile.hasProfile
                ? (paymentProfile.maskedUpiId ?? t("payment:profile.notAdded"))
                : t("payment:profile.notAdded")
            }
            weight="medium"
          />
        </View>
        <View style={{ marginTop: spacing.sm, gap: spacing.xs }}>
          <Text
            text={t("payment:profile.currentName")}
            size="xs"
            style={{ color: colors.textDim }}
          />
          <Text
            text={
              paymentProfile.hasProfile
                ? (paymentProfile.payeeLabel ?? t("payment:profile.notAdded"))
                : t("payment:profile.notAdded")
            }
            weight="medium"
          />
        </View>
        <View style={{ marginTop: spacing.md }}>
          <Button
            text={
              paymentProfile.hasProfile
                ? t("payment:profile.manageCta")
                : t("payment:profile.addCta")
            }
            onPress={() => navigation.navigate("PaymentProfile", { entryPoint: "profile" })}
            style={{ borderRadius: 10, minHeight: 44 }}
          />
        </View>
      </SectionCard>

      <SectionCard>
        <Text
          preset="subheading"
          text={t("oolshik:profileScreen.trustAndSafety")}
          style={{ marginBottom: spacing.sm }}
        />
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Text text={t("oolshik:rating")} size="xs" style={{ color: colors.textDim }} />
            <Text text={ratingText} weight="medium" />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              text={t("oolshik:profileScreen.completedHelps")}
              size="xs"
              style={{ color: colors.textDim }}
            />
            <Text text={completedText} weight="medium" />
          </View>
        </View>

        <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
          <Button
            text={t("oolshik:profileScreen.safetyTips")}
            onPress={() => setShowSafetyTips(true)}
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel={t("oolshik:profileScreen.safetyTipsA11y")}
          />
          <Button
            text={t("oolshik:profileScreen.reportIssue")}
            onPress={onReportIssue}
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel={t("oolshik:profileScreen.reportIssueA11y")}
          />
          {remoteWhatsapp ? (
            <Button
              text={t("oolshik:profileScreen.contactWhatsApp")}
              onPress={onContactWhatsApp}
              style={{ borderRadius: 10, minHeight: 44 }}
            />
          ) : null}
        </View>
      </SectionCard>

      <SectionCard>
        <Text
          preset="subheading"
          text={t("oolshik:profileScreen.preferences")}
          style={{ marginBottom: spacing.sm }}
        />

        <View style={{ gap: spacing.sm }}>
          <Text text={t("oolshik:language")} size="xs" style={{ color: colors.textDim }} />
          <RadioGroup
            value={languageValue}
            onChange={(v) => onLanguageChange(v as "mr" | "en")}
            options={[
              { label: t("oolshik:marathi"), value: "mr" },
              { label: t("oolshik:english"), value: "en" },
            ]}
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
            <Text text={t("oolshik:profileScreen.locationPermission")} weight="medium" />
            <Text text={locationLabel} size="xs" style={{ color: colors.textDim }} />
          </View>
          <Button
            text={t("oolshik:profileScreen.openSettings")}
            onPress={openSettings}
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel={t("oolshik:profileScreen.openSettingsA11y")}
          />
        </View>
      </SectionCard>

      <SectionCard>
        <Text
          preset="subheading"
          tx="oolshik:feedback.title"
          style={{ marginBottom: spacing.sm }}
        />
        <Text tx="oolshik:feedback.subtitle" size="xs" style={{ color: colors.textDim }} />
        <View style={{ marginTop: spacing.sm }}>
          <Button
            tx="oolshik:feedback.openFeedback"
            onPress={() => navigation.navigate("OolshikFeedbackHub")}
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel={t("oolshik:profileScreen.openFeedbackA11y")}
          />
        </View>
      </SectionCard>

      <SectionCard>
        <Text
          preset="subheading"
          text={t("oolshik:profileScreen.account")}
          style={{ marginBottom: spacing.sm }}
        />
        <View style={{ marginBottom: spacing.sm }}>
          <Text
            text={t("oolshik:profileScreen.appVersion")}
            size="xs"
            style={{ color: colors.textDim }}
          />
          <Text text={versionLabel} weight="medium" />
        </View>
        <View style={{ gap: spacing.sm }}>
          <Button
            text={t("oolshik:profileScreen.editProfile")}
            onPress={() => navigation.navigate("OolshikProfileEdit")}
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel={t("oolshik:profileScreen.editProfileA11y")}
          />
          <Button
            text={t("oolshik:profileScreen.logout")}
            onPress={logout}
            style={{
              borderRadius: 10,
              minHeight: 44,
              backgroundColor: colors.error,
              borderWidth: 0,
            }}
            textStyle={{ color: colors.palette.neutral100 }}
            accessibilityLabel={t("oolshik:profileScreen.logoutA11y")}
          />
          <Button
            text={t("oolshik:profileScreen.deleteAccountSoon")}
            disabled
            style={{ borderRadius: 10, minHeight: 44 }}
            accessibilityLabel={t("oolshik:profileScreen.deleteAccountA11y")}
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
            <Text preset="heading" text={t("oolshik:profileScreen.safetyTipsHeading")} />
            <ScrollView style={{ marginTop: spacing.md }}>
              {[
                t("oolshik:profileScreen.safetyTip1"),
                t("oolshik:profileScreen.safetyTip2"),
                t("oolshik:profileScreen.safetyTip3"),
                t("oolshik:profileScreen.safetyTip4"),
              ].map((tip) => (
                <View key={tip} style={{ marginBottom: spacing.sm }}>
                  <Text text={`• ${tip}`} />
                </View>
              ))}
            </ScrollView>
            <View style={{ marginTop: spacing.md }}>
              <Button
                text={t("oolshik:profileScreen.close")}
                onPress={() => setShowSafetyTips(false)}
                style={{ borderRadius: 10, minHeight: 44 }}
                accessibilityLabel={t("oolshik:profileScreen.closeSafetyTipsA11y")}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  )
}
