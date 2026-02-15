import React, { useMemo, useState, useEffect } from "react"
import { View, Pressable, Modal, ScrollView } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { RadioGroup } from "@/components/RadioGroup"
import { useAppTheme } from "@/theme/context"
import { useTranslation } from "react-i18next"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { storage } from "@/utils/storage"
import { useMMKVString } from "react-native-mmkv"
import {
  fromLanguageCode,
  pickDeviceLocaleTag,
  resolvePreferredLocale,
  toLanguageCode,
} from "@/i18n/locale"
import {
  getProfileExtras,
  updateProfileExtras,
} from "@/features/profile/storage/profileExtrasStore"

const CONSENT_VERSION = "v1"

export default function OnboardingConsentScreen({ navigation }: any) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { t, i18n } = useTranslation()

  const [onboardingComplete, setOnboardingComplete] = useMMKVString(
    "onboarding.v1.completed",
    storage,
  )
  const [, setConsentMeta] = useMMKVString("consent.v1.meta", storage)

  const { granted, request } = useForegroundLocation({ autoRequest: false }) as {
    granted?: boolean
    request?: () => void
  }

  const [accepted, setAccepted] = useState(false)
  const [lang, setLang] = useState<"mr" | "en">(toLanguageCode(i18n.language))
  const [showConsent, setShowConsent] = useState(false)

  useEffect(() => {
    let active = true
    ;(async () => {
      let localPreference: string | null = null
      try {
        const extras = await getProfileExtras()
        localPreference = extras.preferredLanguage ?? extras.language ?? null
      } catch {
        // best-effort
      }

      const resolved = resolvePreferredLocale({
        localPreference,
        deviceLocaleTag: pickDeviceLocaleTag() ?? null,
      })
      const resolvedCode = toLanguageCode(resolved)
      if (!active) return
      setLang(resolvedCode)
      await i18n.changeLanguage(resolved)
      try {
        await updateProfileExtras({
          preferredLanguage: resolved,
          language: resolved,
        })
      } catch {
        // best-effort
      }
    })()
    return () => {
      active = false
    }
  }, [i18n])

  const onLanguageChange = async (next: "mr" | "en") => {
    setLang(next)
    const resolved = fromLanguageCode(next)
    await i18n.changeLanguage(resolved)
    try {
      await updateProfileExtras({
        preferredLanguage: resolved,
        language: resolved,
      })
    } catch {
      // best-effort
    }
  }

  const canContinue = useMemo(() => Boolean(accepted && granted), [accepted, granted])

  const consentSections = [
    {
      title: t("oolshik:consent.section1Title"),
      items: [
        t("oolshik:consent.section1Item1"),
        `• ${t("oolshik:consent.section1Item2")}`,
        `• ${t("oolshik:consent.section1Item3")}`,
        `• ${t("oolshik:consent.section1Item4")}`,
        `• ${t("oolshik:consent.section1Item5")}`,
      ],
    },
    {
      title: t("oolshik:consent.section2Title"),
      items: [
        `• ${t("oolshik:consent.section2Item1")}`,
        `• ${t("oolshik:consent.section2Item2")}`,
        `• ${t("oolshik:consent.section2Item3")}`,
        `• ${t("oolshik:consent.section2Item4")}`,
      ],
    },
    {
      title: t("oolshik:consent.section3Title"),
      items: [
        `• ${t("oolshik:consent.section3Item1")}`,
        `• ${t("oolshik:consent.section3Item2")}`,
        `• ${t("oolshik:consent.section3Item3")}`,
      ],
    },
    {
      title: t("oolshik:consent.section4Title"),
      items: [
        `• ${t("oolshik:consent.section4Item1")}`,
        `• ${t("oolshik:consent.section4Item2")}`,
        `• ${t("oolshik:consent.section4Item3")}`,
      ],
    },
    {
      title: t("oolshik:consent.section5Title"),
      items: [
        `• ${t("oolshik:consent.section5Item1")}`,
        `• ${t("oolshik:consent.section5Item2")}`,
      ],
    },
  ]

  /* =======================
     UI HELPERS
     ======================= */

  const Checkbox = ({ checked, onPress }: { checked: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.palette.neutral400,
        backgroundColor: checked ? colors.palette.primary500 : colors.palette.neutral100,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked ? <Text text="✓" style={{ color: "white" }} /> : null}
    </Pressable>
  )

  /* =======================
     RENDER
     ======================= */

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]} contentContainerStyle={{ flex: 1 }}>
      <View style={{ padding: spacing.md }}>
        <Text preset="heading" text={t("oolshik:consent.title")} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing.md, gap: spacing.lg }}>
        <RadioGroup
          value={lang}
          onChange={(v) => {
            onLanguageChange(v as "mr" | "en")
          }}
          options={[
            { label: t("oolshik:marathi"), value: "mr" },
            { label: t("oolshik:english"), value: "en" },
          ]}
        />

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Checkbox
            checked={accepted}
            onPress={() => {
              if (accepted) {
                setAccepted(false)
              } else {
                setShowConsent(true)
              }
            }}
          />
          <Pressable
            onPress={() => setShowConsent(true)}
            style={{ flex: 1 }}
            accessibilityRole="button"
          >
            <Text text={t("oolshik:consent.agree")} />
          </Pressable>
        </View>

        {accepted ? (
          !granted ? (
            <Button
              text={t("oolshik:consent.allowLocation")}
              onPress={async () => {
                try {
                  await request?.()
                } catch {}
              }}
            />
          ) : (
            <Text
              text={t("oolshik:consent.locationGranted")}
              size="xs"
              style={{ color: colors.palette.neutral600 }}
            />
          )
        ) : null}
      </View>

      {/* CONSENT MODAL */}
      <Modal visible={showConsent} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.5)",
            justifyContent: "center",
            padding: spacing.lg,
          }}
        >
          <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: spacing.md }}>
            <ScrollView>
              <Text text={t("oolshik:consent.preface")} />
              {consentSections.map((s, i) => (
                <View key={i} style={{ marginVertical: 8 }}>
                  <Text text={s.title} weight="bold" />
                  {s.items.map((it, j) => (
                    <Text key={j} text={it} />
                  ))}
                </View>
              ))}
              <Text weight="bold" text={t("oolshik:consent.declarationTitle")} />
              <Text text={t("oolshik:consent.declarationBody")} />
            </ScrollView>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button
                text={t("oolshik:consent.close")}
                onPress={() => setShowConsent(false)}
                style={{ flex: 1 }}
              />
              <Button
                text={t("oolshik:consent.ok")}
                onPress={async () => {
                  setAccepted(true)
                  setConsentMeta(
                    JSON.stringify({
                      version: CONSENT_VERSION,
                      lang,
                      acceptedAt: new Date().toISOString(),
                    }),
                  )
                  setShowConsent(false)
                  try {
                    await request?.()
                  } catch {}
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ padding: spacing.md }}>
        <Button
          text={t("oolshik:consent.continue")}
          disabled={!canContinue}
          onPress={() => {
            if (!canContinue) return
            setOnboardingComplete("true")
            navigation.replace("OolshikHome")
          }}
        />
      </View>
    </Screen>
  )
}
