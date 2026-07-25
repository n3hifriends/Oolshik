import React, { useMemo, useState, useEffect } from "react"
import { View, Pressable, Modal, ScrollView, ActivityIndicator } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { RadioGroup } from "@/components/RadioGroup"
import { SectionCard } from "@/components/SectionCard"
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
import { OolshikApi, type PaymentProfileApiResponse } from "@/api"
import { getFcmTokenAsync } from "@/utils/pushNotifications"
import { useAuth } from "@/context/AuthContext"
import { PermissionsInfoSheet } from "@/screens/onboarding/PermissionsInfoSheet"

const CONSENT_VERSION = "v1"

export default function OnboardingConsentScreen({ navigation }: any) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { t, i18n } = useTranslation()
  const { setOnboardingPhase } = useAuth()

  const [onboardingComplete, setOnboardingComplete] = useMMKVString(
    "onboarding.v1.completed",
    storage,
  )
  const [, setConsentMeta] = useMMKVString("consent.v1.meta", storage)

  const { coords, granted, status: locationStatus, request } = useForegroundLocation({
    autoRequest: false,
  }) as {
    coords?: { latitude: number; longitude: number } | null
    granted?: boolean
    status?: "idle" | "loading" | "ready" | "denied" | "error"
    request?: () => void
  }

  const [accepted, setAccepted] = useState(false)
  const [lang, setLang] = useState<"mr" | "en">(toLanguageCode(i18n.language))
  const [showConsent, setShowConsent] = useState(false)
  const [showPermissionsInfo, setShowPermissionsInfo] = useState(false)
  const [paymentProfile, setPaymentProfile] = useState<PaymentProfileApiResponse>({ hasProfile: false })
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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

  useFocusEffect(
    React.useCallback(() => {
      let active = true
      ;(async () => {
        try {
          const response = await OolshikApi.getMyPaymentProfile()
          if (!active) return
          if (response.ok && response.data) {
            setPaymentProfile(response.data)
          } else {
            setPaymentProfile({ hasProfile: false })
          }
        } catch {
          if (active) setPaymentProfile({ hasProfile: false })
        }
      })()
      return () => {
        active = false
      }
    }, []),
  )

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

  // A GPS fix (`coords`) is best-effort, not required: the zone-eligibility check
  // performed on Continue already falls back to "eligible" when `coords` is absent
  // (see the Continue handler below), so gating the button on `granted` alone keeps
  // the UI consistent with what actually happens after it's pressed.
  const canContinue = useMemo(() => Boolean(accepted && granted), [accepted, granted])
  const isLocating = granted && locationStatus === "loading" && !coords
  const locationFailed = granted && locationStatus === "error" && !coords

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
        backgroundColor: checked ? colors.palette.primary500 : colors.background,
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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.lg }}
        showsVerticalScrollIndicator={false}
      >
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
            <View style={{ gap: spacing.xxs }}>
              <Text
                text={t("oolshik:consent.locationGranted")}
                size="xs"
                style={{ color: colors.palette.neutral600 }}
              />
              {isLocating ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <ActivityIndicator size="small" />
                  <Text
                    text={t("oolshik:consent.locating")}
                    size="xs"
                    style={{ color: colors.palette.neutral600 }}
                  />
                </View>
              ) : null}
              {locationFailed ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
                  <Text
                    text={t("oolshik:consent.locationErrorBody")}
                    size="xs"
                    style={{ color: colors.palette.neutral600 }}
                  />
                  <Pressable
                    onPress={async () => {
                      try {
                        await request?.()
                      } catch {}
                    }}
                    accessibilityRole="button"
                  >
                    <Text
                      text={t("oolshik:consent.retryLocation")}
                      size="xs"
                      weight="medium"
                      style={{ color: colors.palette.primary600 }}
                    />
                  </Pressable>
                </View>
              ) : null}
            </View>
          )
        ) : null}

        {showPaymentPrompt || paymentProfile.hasProfile ? (
          <SectionCard>
            <Text weight="medium" text={t("payment:profile.onboardingCardTitle")} />
            <View style={{ height: spacing.xs }} />
            <Text text={t("payment:profile.onboardingCardBody")} size="xs" style={{ color: colors.textDim }} />
            <View style={{ height: spacing.sm }} />
            {paymentProfile.hasProfile ? (
              <Text
                text={t("payment:profile.onboardingAdded", { upiId: paymentProfile.maskedUpiId ?? "—" })}
                size="xs"
                style={{ color: colors.palette.primary600 }}
              />
            ) : (
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <Button
                  text={t("payment:profile.addNowCta")}
                  onPress={() => navigation.navigate("PaymentProfile", { entryPoint: "onboarding" })}
                  style={{ flex: 1 }}
                />
                <Button
                  text={t("payment:profile.skipForNowCta")}
                  onPress={() => setShowPaymentPrompt(false)}
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </SectionCard>
        ) : null}
      </ScrollView>

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
          <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md }}>
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

      <PermissionsInfoSheet
        visible={showPermissionsInfo}
        onDismiss={() => setShowPermissionsInfo(false)}
      />

      <View style={{ paddingHorizontal: spacing.md, gap: spacing.xxs }}>
        <Text
          text={t("oolshik:consent.permissions.title")}
          weight="medium"
          size="xs"
        />
        <Text
          text={t("oolshik:consent.permissions.locationSummary")}
          size="xxs"
          style={{ color: colors.textDim }}
        />
        <Text
          text={t("oolshik:consent.permissions.notificationsSummary")}
          size="xxs"
          style={{ color: colors.textDim }}
        />
        <Text
          text={t("oolshik:consent.permissions.mediaSummary")}
          size="xxs"
          style={{ color: colors.textDim }}
        />
        <Pressable
          onPress={() => setShowPermissionsInfo(true)}
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10 }}
          style={{ minHeight: 44, justifyContent: "center", alignSelf: "flex-start" }}
        >
          <Text
            text={t("oolshik:consent.permissions.whyWeAsk")}
            size="xs"
            weight="medium"
            style={{ color: colors.palette.primary600, textDecorationLine: "underline" }}
          />
        </Pressable>
      </View>

      <View style={{ padding: spacing.md }}>
        <Button
          text={t("oolshik:consent.continue")}
          disabled={!canContinue || submitting}
          loading={submitting}
          onPress={async () => {
            if (!canContinue || submitting) return
            setSubmitting(true)
            try {
              let eligible = true
              if (coords) {
                try {
                  const zoneRes = await OolshikApi.checkZone(coords.latitude, coords.longitude)
                  if (zoneRes.ok && zoneRes.data) {
                    eligible = zoneRes.data.eligible
                  }
                } catch {
                  // network error — fail open so a blip doesn't permanently block the user
                }
              }

              if (eligible) {
                setOnboardingPhase("INTENT_SET")
                setOnboardingComplete("true")
                // Request notification permission before navigating so the system dialog
                // appears on this screen. If it fires after navigation the app goes
                // inactive mid-GPS-acquisition and can push the cold-start past the 12s
                // timeout, leaving the feed stuck on "fetching your location".
                // A 6s cap ensures a slow/offline getToken() never blocks navigation.
                await Promise.race([
                  getFcmTokenAsync().catch(() => null),
                  new Promise<null>((resolve) => { setTimeout(() => resolve(null), 6_000) }),
                ])
                navigation.replace("OolshikHome")
              } else {
                // Request notification permission even for ineligible users so they
                // receive push notifications if zone access is later granted.
                // AuthContext FCM registration is gated on onboardingComplete=true, which
                // is never set here, so this fire-and-forget is the only registration path.
                getFcmTokenAsync().catch(() => {})
                setSubmitting(false)
                navigation.navigate("OolshikZoneGate")
              }
            } catch {
              setSubmitting(false)
            }
          }}
        />
      </View>
    </Screen>
  )
}
