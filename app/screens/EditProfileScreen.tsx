import React, { useCallback, useEffect, useState } from "react"
import { Pressable, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { TextField } from "@/components/TextField"
import { SectionCard } from "@/components/SectionCard"
import { Switch } from "@/components/Toggle/Switch"
import { useAppTheme } from "@/theme/context"
import { useAuth } from "@/context/AuthContext"
import type { ProfileExtras } from "@/features/profile/types"
import {
  getProfileExtras,
  updateProfileExtras,
} from "@/features/profile/storage/profileExtrasStore"

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
  const [radius, setRadius] = useState("")
  const [available, setAvailable] = useState(true)
  const [saving, setSaving] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [radiusError, setRadiusError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    getProfileExtras().then((data) => {
      if (!active) return
      const extras: ProfileExtras = data ?? {}
      setFullName(extras.fullNameOverride ?? "")
      setNickname(extras.nickname ?? "")
      setLocality(extras.locality ?? "")
      setRadius(extras.helperRadiusKm ? String(extras.helperRadiusKm) : "")
      setAvailable(extras.helperAvailable ?? true)
    })

    return () => {
      active = false
    }
  }, [])

  const handleSave = useCallback(async () => {
    setNameError(null)
    setRadiusError(null)

    const cleanedFullName = fullName.trim()
    const cleanedNickname = nickname.trim()
    const cleanedLocality = locality.trim()
    const radiusValue = radius.trim()

    if (canEditName && cleanedFullName && cleanedFullName.length < 2) {
      setNameError(t("oolshik:editProfileScreen.nameTooShort"))
      return
    }

    let parsedRadius: number | undefined
    if (radiusValue.length > 0) {
      const numeric = Number(radiusValue)
      if (!Number.isFinite(numeric) || numeric <= 0) {
        setRadiusError(t("oolshik:editProfileScreen.radiusInvalid"))
        return
      }
      parsedRadius = numeric
    }

    setSaving(true)
    const patch: Partial<ProfileExtras> = {
      nickname: cleanedNickname || undefined,
      locality: cleanedLocality || undefined,
      helperRadiusKm: parsedRadius,
      helperAvailable: available,
    }

    if (canEditName) {
      patch.fullNameOverride = cleanedFullName || undefined
    }

    await updateProfileExtras(patch)
    setSaving(false)
    navigation.goBack()
  }, [available, canEditName, fullName, locality, nickname, radius, navigation, t])

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
        <TextField
          label={t("oolshik:editProfileScreen.preferredRadius")}
          placeholder={t("oolshik:editProfileScreen.radiusExample")}
          value={radius}
          onChangeText={setRadius}
          keyboardType="numeric"
          helper={radiusError ?? t("oolshik:editProfileScreen.optional")}
          status={radiusError ? "error" : undefined}
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
