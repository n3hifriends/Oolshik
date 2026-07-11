import React, { useCallback, useEffect, useState } from "react"
import { Linking, Pressable, View } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { useTranslation } from "react-i18next"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { TextField } from "@/components/TextField"
import { SectionCard } from "@/components/SectionCard"
import { Switch } from "@/components/Toggle/Switch"
import { RadioGroup } from "@/components/RadioGroup"
import { useAppTheme } from "@/theme/context"
import { useAuth } from "@/context/AuthContext"
import type { ProfileExtras } from "@/features/profile/types"
import {
  getProfileExtras,
  updateProfileExtras,
} from "@/features/profile/storage/profileExtrasStore"
import {
  disablePushNotifications,
  enablePushNotifications,
  getNotificationPermissionState,
} from "@/utils/pushNotifications"
import type { Radius } from "@/screens/home-feed/types"
import { RADIUS_OPTIONS, normalizeRadius } from "@/screens/home-feed/helpers/homeFeedFormatters"

export default function EditProfileScreen({ navigation }: { navigation: any }) {
  const { t } = useTranslation()
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { userName, authEmail } = useAuth()

  const authName = userName && userName !== "You" ? userName : undefined
  const canEditName = !authName

  const [fullName, setFullName] = useState("")
  const [nickname, setNickname] = useState("")
  const [locality, setLocality] = useState("")
  const [radius, setRadius] = useState<Radius | 0>(0)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [notifPermissionState, setNotifPermissionState] = useState(getNotificationPermissionState)
  const [available, setAvailable] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getProfileExtras().then((data) => {
      if (!active) return
      const extras: ProfileExtras = data ?? {}
      setFullName(extras.fullNameOverride ?? "")
      setNickname(extras.nickname ?? "")
      setLocality(extras.locality ?? "")
      setRadius(extras.helperRadiusKm ? normalizeRadius(extras.helperRadiusKm) : 0)
      setNotificationsEnabled(extras.notificationsEnabled ?? true)
      setAvailable(extras.helperAvailable ?? true)
    })

    return () => {
      active = false
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      setNotifPermissionState(getNotificationPermissionState())
    }, []),
  )

  const handleSave = useCallback(async () => {
    setNameError(null)

    const cleanedFullName = fullName.trim()
    const cleanedNickname = nickname.trim()
    const cleanedLocality = locality.trim()

    if (canEditName && cleanedFullName && cleanedFullName.length < 2) {
      setNameError(t("oolshik:editProfileScreen.nameTooShort"))
      return
    }

    setSaving(true)
    const patch: Partial<ProfileExtras> = {
      nickname: cleanedNickname || undefined,
      locality: cleanedLocality || undefined,
      notificationsEnabled,
      helperRadiusKm: radius !== 0 ? radius : undefined,
      helperAvailable: available,
    }

    if (canEditName) {
      patch.fullNameOverride = cleanedFullName || undefined
    }

    await updateProfileExtras(patch)
    if (notificationsEnabled) {
      enablePushNotifications().catch(() => {})
    } else {
      disablePushNotifications().catch(() => {})
    }
    setSaving(false)
    navigation.goBack()
  }, [available, canEditName, fullName, locality, nickname, notificationsEnabled, radius, navigation, t])

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

      <Text preset="heading" text={t("oolshik:editProfileScreen.heading")} />

      <SectionCard>
        <Text text={t("oolshik:editProfileScreen.signedInAs")} size="xs" style={{ color: colors.textDim }} />
        <Text text={authName ?? t("oolshik:editProfileScreen.account")} weight="medium" />
        <Text text={authEmail || "—"} size="xs" style={{ color: colors.textDim }} />
      </SectionCard>

      <SectionCard>
        {canEditName ? (
          <TextField
            label={t("oolshik:editProfileScreen.fullName")}
            placeholder={t("oolshik:editProfileScreen.yourName")}
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            helper={nameError ?? t("oolshik:editProfileScreen.fullNameHint")}
            status={nameError ? "error" : undefined}
          />
        ) : (
          <Text
            text={t("oolshik:editProfileScreen.fullNameManaged")}
            size="xs"
            style={{ color: colors.textDim }}
          />
        )}

        <View style={{ height: spacing.md }} />

        <TextField
          label={t("oolshik:editProfileScreen.nickname")}
          placeholder={t("oolshik:editProfileScreen.optional")}
          value={nickname}
          onChangeText={setNickname}
          autoCapitalize="words"
        />

        <View style={{ height: spacing.md }} />

        <TextField
          label={t("oolshik:editProfileScreen.locality")}
          placeholder={t("oolshik:editProfileScreen.optional")}
          value={locality}
          onChangeText={setLocality}
          autoCapitalize="words"
        />
      </SectionCard>

      <SectionCard>
        <Text preset="subheading" text={t("oolshik:editProfileScreen.helperDefaults")} style={{ marginBottom: spacing.sm }} />
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: spacing.lg,
          }}
        >
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text text={t("oolshik:profileScreen.notifications")} weight="medium" />
            <Text text={t("oolshik:profileScreen.notificationsHint")} size="xs" style={{ color: colors.textDim }} />
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={setNotificationsEnabled}
            accessibilityLabel={t("oolshik:profileScreen.notificationsToggleA11y")}
          />
        </View>
        {notificationsEnabled && notifPermissionState === "denied" ? (
          <Pressable onPress={() => Linking.openSettings().catch(() => {})} accessibilityRole="button">
            <Text
              text={t("oolshik:profileScreen.notificationsPermissionDeniedHint")}
              size="xs"
              style={{ color: colors.palette.warning500, marginTop: spacing.xs }}
            />
          </Pressable>
        ) : null}

        <Text text={t("oolshik:editProfileScreen.preferredRadius")} size="sm" weight="medium" />
        <View style={{ height: spacing.xs }} />
        <RadioGroup
          value={radius}
          onChange={(v) => setRadius(v as Radius | 0)}
          wrap
          gap={spacing.sm}
          options={[
            { label: t("oolshik:editProfileScreen.radiusNone"), value: 0 },
            ...RADIUS_OPTIONS.map((km) => ({ label: `${km} km`, value: km })),
          ]}
        />
        <Text
          text={t("oolshik:editProfileScreen.radiusHint")}
          size="xs"
          style={{ color: colors.textDim, marginTop: spacing.xs }}
        />

        <View
          style={{
            marginTop: spacing.lg,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View style={{ flex: 1, paddingRight: spacing.md }}>
            <Text text={t("oolshik:editProfileScreen.availableToHelp")} weight="medium" />
            <Text text={t("oolshik:editProfileScreen.localOnlySetting")} size="xs" style={{ color: colors.textDim }} />
          </View>
          <Switch
            value={available}
            onValueChange={setAvailable}
            accessibilityLabel={t("oolshik:editProfileScreen.helperAvailabilityA11y")}
          />
        </View>
      </SectionCard>

      <View style={{ gap: spacing.sm }}>
        <Button
          text={saving ? t("oolshik:editProfileScreen.saving") : t("oolshik:editProfileScreen.save")}
          onPress={handleSave}
          disabled={saving}
          style={{ borderRadius: 10, minHeight: 44 }}
          accessibilityLabel={t("oolshik:editProfileScreen.saveProfileA11y")}
        />
        <Button
          text={t("oolshik:editProfileScreen.cancel")}
          onPress={() => navigation.goBack()}
          style={{ borderRadius: 10, minHeight: 44 }}
          accessibilityLabel={t("oolshik:editProfileScreen.cancelA11y")}
        />
      </View>
    </Screen>
  )
}
