import React, { useCallback, useEffect, useState } from "react"
import { Pressable, View } from "react-native"

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
      setNameError("Name must be at least 2 characters.")
      return
    }

    let parsedRadius: number | undefined
    if (radiusValue.length > 0) {
      const numeric = Number(radiusValue)
      if (!Number.isFinite(numeric) || numeric <= 0) {
        setRadiusError("Enter a valid radius.")
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
  }, [available, canEditName, fullName, locality, nickname, radius, navigation])

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.lg }}
    >
      <Pressable
        onPress={() => navigation.goBack()}
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        style={{ alignSelf: "flex-start" }}
      >
        <Text text="← Back" />
      </Pressable>

      <Text preset="heading" text="Edit Profile" />

      <SectionCard>
        <Text text="Signed in as" size="xs" style={{ color: colors.textDim }} />
        <Text text={authName ?? "Account"} weight="medium" />
        <Text text={authEmail || "—"} size="xs" style={{ color: colors.textDim }} />
      </SectionCard>

      <SectionCard>
        {canEditName ? (
          <TextField
            label="Full name"
            placeholder="Your name"
            value={fullName}
            onChangeText={setFullName}
            autoCapitalize="words"
            helper={nameError ?? "Shown only when account name is missing."}
            status={nameError ? "error" : undefined}
          />
        ) : (
          <Text
            text="Full name is managed by your login account."
            size="xs"
            style={{ color: colors.textDim }}
          />
        )}

        <View style={{ height: spacing.md }} />

        <TextField
          label="Nickname"
          placeholder="Optional"
          value={nickname}
          onChangeText={setNickname}
          autoCapitalize="words"
        />

        <View style={{ height: spacing.md }} />

        <TextField
          label="Locality / Area"
          placeholder="Optional"
          value={locality}
          onChangeText={setLocality}
          autoCapitalize="words"
        />
      </SectionCard>

      <SectionCard>
        <Text preset="subheading" text="Helper defaults" style={{ marginBottom: spacing.sm }} />
        <TextField
          label="Preferred radius (km)"
          placeholder="e.g., 2"
          value={radius}
          onChangeText={setRadius}
          keyboardType="numeric"
          helper={radiusError ?? "Optional"}
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
            <Text text="Available to help" weight="medium" />
            <Text text="Local-only setting" size="xs" style={{ color: colors.textDim }} />
          </View>
          <Switch
            value={available}
            onValueChange={setAvailable}
            accessibilityLabel="Helper availability"
          />
        </View>
      </SectionCard>

      <View style={{ gap: spacing.sm }}>
        <Button
          text={saving ? "Saving..." : "Save"}
          onPress={handleSave}
          disabled={saving}
          style={{ borderRadius: 10, minHeight: 44 }}
          accessibilityLabel="Save profile"
        />
        <Button
          text="Cancel"
          onPress={() => navigation.goBack()}
          style={{ borderRadius: 10, minHeight: 44 }}
          accessibilityLabel="Cancel"
        />
      </View>
    </Screen>
  )
}
