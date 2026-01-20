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

const CONSENT_VERSION = "v1"

export default function OnboardingConsentScreen({ navigation }: any) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { i18n } = useTranslation()

  const [onboardingComplete, setOnboardingComplete] = useMMKVString(
    "onboarding.v1.completed",
    storage,
  )
  const [, setConsentMeta] = useMMKVString("consent.v1.meta", storage)

  const { granted, request } = useForegroundLocation({ autoRequest: false }) as {
    granted?: boolean
    request?: () => Promise<void>
  }

  const [accepted, setAccepted] = useState(false)
  const [lang, setLang] = useState<"mr" | "en">(i18n.language === "mr" ? "mr" : "en")
  const [showConsent, setShowConsent] = useState(false)

  useEffect(() => {
    i18n.changeLanguage(lang)
  }, [lang])

  const canContinue = useMemo(() => Boolean(accepted && granted), [accepted, granted])

  const uiText = {
    en: {
      title: "User Consent",
      agree: "I have read and agree to the consent terms",
      allowLocation: "Allow location access",
      locationGranted: "Location access granted",
      continue: "Continue",
      ok: "Ok",
      close: "Close",
    },
    mr: {
      title: "वापरकर्ता संमती",
      agree: "मी संमती अटी वाचल्या आहेत व मान्य करतो/करते",
      allowLocation: "स्थान परवानगी द्या",
      locationGranted: "स्थान परवानगी मिळाली",
      continue: "पुढे जा",
      ok: "ठीक आहे",
      close: "बंद करा",
    },
  } as const

  const copy = uiText[lang]

  /* =======================
     CONSENT CONTENT (PATENT-ALIGNED)
     ======================= */

  const consentSections = {
    en: {
      preface: "By continuing, you acknowledge and consent to the following:",
      sections: [
        {
          title: "1. Purpose of Use",
          items: [
            "I voluntarily provide my location, voice recordings, and phone number for use within the Oolshik app to:",
            "• Enable location-based help/task matching between users.",
            "• Facilitate voice-first task creation and communication.",
            "• Allow contact masking, reporting, and task coordination.",
            "• Allow the same application to dynamically operate in requester (Neta) or helper (Karyakarta) roles based on my actions.",
          ],
        },
        {
          title: "2. Data Collection and Retention",
          items: [
            "• My location is collected only in the foreground when the app is active.",
            "• Voice clips (≤30 seconds) may be securely uploaded for playback and moderation.",
            "• Device-level indicators (such as connectivity status) and historical interaction indicators may be processed to improve task delivery reliability.",
            "• Data is retained only as required for lawful and service-related purposes.",
          ],
        },
        {
          title: "3. Consent and Withdrawal",
          items: [
            "• Granting these permissions is essential for app functionality.",
            "• I may withdraw consent anytime by uninstalling the app or contacting support@oolshik.in.",
            "• Upon withdrawal, personal data will be deleted or anonymized unless retention is required by law.",
          ],
        },
        {
          title: "4. Data Security and Privacy",
          items: [
            "• Data is protected using AES-256 encryption at rest and HTTPS in transit.",
            "• Oolshik acts as a Data Fiduciary under the Digital Personal Data Protection Act, 2023.",
            "• Access is restricted to authorized systems and personnel only.",
          ],
        },
        {
          title: "5. Legal Compliance",
          items: [
            "• Oolshik complies with applicable Indian IT laws.",
            "• Jurisdiction: Pune, Maharashtra, India.",
          ],
        },
      ],
      declarationTitle: "✅ User Declaration",
      declarationBody:
        "I have read and understood this consent. By tapping “Ok”, I voluntarily provide my consent as described above.",
    },

    mr: {
      preface: "पुढे चालू ठेवल्यास, आपण खालील बाबींना संमती देत आहात:",
      sections: [
        {
          title: "1. वापराचा उद्देश",
          items: [
            "मी Oolshik अ‍ॅपमध्ये माझे स्थान, व्हॉईस रेकॉर्डिंग आणि फोन नंबर स्वेच्छेने देत आहे:",
            "• स्थानाधारित मदत/टास्क मॅचिंगसाठी.",
            "• व्हॉईस-फर्स्ट संवादासाठी.",
            "• एकाच अ‍ॅपमध्ये ‘नेता’ किंवा ‘कार्यकर्ता’ म्हणून भूमिका बदलण्यासाठी.",
          ],
        },
        {
          title: "2. डेटा संकलन",
          items: [
            "• स्थान फक्त अ‍ॅप सक्रिय असताना घेतले जाते.",
            "• नेटवर्क स्थिती व पूर्वीचे परस्परसंवाद विश्वसनीयतेसाठी वापरले जाऊ शकतात.",
          ],
        },
        {
          title: "3. संमती",
          items: [
            "• संमती मागे घेण्यासाठी अ‍ॅप काढून टाका किंवा support@oolshik.in वर संपर्क करा.",
          ],
        },
        {
          title: "4. कायदेशीर पालन",
          items: [
            "• Oolshik, Digital Personal Data Protection Act, 2023 नुसार कार्य करते.",
            "• अधिकारक्षेत्र: पुणे, महाराष्ट्र.",
          ],
        },
      ],
      declarationTitle: "✅ वापरकर्ता जाहीरनामा",
      declarationBody: "“Ok” टॅप करून मी वरील सर्व अटी समजून संमती देतो/देते.",
    },
  } as const

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
        <Text preset="heading" text={copy.title} />
      </View>

      <View style={{ flex: 1, paddingHorizontal: spacing.md, gap: spacing.lg }}>
        <RadioGroup
          value={lang}
          onChange={(v) => setLang(v as "mr" | "en")}
          options={[
            { label: "मराठी", value: "mr" },
            { label: "English", value: "en" },
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
            <Text text={copy.agree} />
          </Pressable>
        </View>

        {accepted ? (
          !granted ? (
            <Button
              text={copy.allowLocation}
              onPress={async () => {
                try {
                  await request?.()
                } catch {}
              }}
            />
          ) : (
            <Text
              text={copy.locationGranted}
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
              <Text text={consentSections[lang].preface} />
              {consentSections[lang].sections.map((s, i) => (
                <View key={i} style={{ marginVertical: 8 }}>
                  <Text text={s.title} weight="bold" />
                  {s.items.map((it, j) => (
                    <Text key={j} text={it} />
                  ))}
                </View>
              ))}
              <Text weight="bold" text={consentSections[lang].declarationTitle} />
              <Text text={consentSections[lang].declarationBody} />
            </ScrollView>

            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Button text={copy.close} onPress={() => setShowConsent(false)} style={{ flex: 1 }} />
              <Button
                text={copy.ok}
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
          text={copy.continue}
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
