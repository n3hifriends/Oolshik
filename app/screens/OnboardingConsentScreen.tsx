import React, { useMemo, useState } from "react"
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

export default function OnboardingConsentScreen({ navigation }: any) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { i18n } = useTranslation()
  const [onboardingComplete, setOnboardingComplete] = useMMKVString(
    "onboarding.v1.completed",
    storage,
  )

  // location hook (assumes it exposes `granted` and maybe a `request` function)
  const { granted, request } = useForegroundLocation() as {
    granted?: boolean
    request?: () => Promise<void>
  }

  const [accepted, setAccepted] = useState(false)
  const [lang, setLang] = useState<"mr" | "en">(i18n.language === "mr" ? "mr" : "en")
  const [showConsent, setShowConsent] = useState(false)

  // Bilingual consent content (English & Marathi) — exact wording
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
          ],
        },
        {
          title: "2. Data Collection and Retention",
          items: [
            "• My location is collected only in the foreground when the app is active and used to find nearby helpers (“Karyakarta”) or requesters (“Neta”).",
            "• My voice clips (≤30 s) may be uploaded to secure servers for playback and moderation.",
            "• My phone number is stored in encrypted form and masked in app-to-app communication.",
            "• Data is retained only as long as necessary for lawful and service-related purposes.",
          ],
        },
        {
          title: "3. Consent and Withdrawal",
          items: [
            "• I understand that granting these permissions is essential for app functionality.",
            "• I may withdraw my consent anytime by uninstalling the app or contacting support at support@oolshik.in.",
            "• Upon withdrawal, my personal data will be deleted or anonymized within a reasonable time, except where retention is required by law.",
          ],
        },
        {
          title: "4. Data Security and Privacy",
          items: [
            "• My information is protected with AES-256 encryption at rest and secure HTTPS transmission.",
            "• Oolshik follows reasonable security practices under the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.",
            "• Access to my data is strictly limited to authorized systems and personnel.",
          ],
        },
        {
          title: "5. Behavior, Content, and Community Conduct",
          items: [
            "• I will not post or share any politically sensitive, abusive, misleading, or harmful content.",
            "• Any attempt to spread disinformation, hate speech, or harassment may result in immediate suspension and reporting to authorities.",
            "• Oolshik reserves the right to review or remove content violating Indian laws or community standards.",
          ],
        },
        {
          title: "6. Liability and Indemnification",
          items: [
            "• I understand that Oolshik is a peer-to-peer platform connecting users voluntarily and does not guarantee the outcome or safety of any offline interaction.",
            "• I agree that I am solely responsible for my behavior and communication.",
            "• Oolshik and its affiliates are not liable for any loss, injury, damage, or dispute arising out of user interactions, misuse, or technical errors.",
          ],
        },
        {
          title: "7. Legal Compliance",
          items: [
            "• Oolshik operates in compliance with the Digital Personal Data Protection Act, 2023, and other applicable Indian IT laws.",
            "• Any dispute shall be subject to the jurisdiction of Pune, Maharashtra, India.",
          ],
        },
      ],
      declarationTitle: "✅ User Declaration",
      declarationBody:
        "I have read and understood this consent. By tapping “I Agree and Continue”, I voluntarily provide my consent for Oolshik to collect, store, and process my data as described above.",
    },
    mr: {
      preface: "पुढे चालू ठेवल्यास, आपण खालील बाबींना मान्य करून संमती देत आहात:",
      sections: [
        {
          title: "1. वापराचा उद्देश",
          items: [
            "मी Oolshik अ‍ॅपमध्ये वापरासाठी माझे स्थान (Location), व्हॉईस रेकॉर्डिंग्ज आणि फोन नंबर स्वेच्छेने देत आहे, ज्यामुळे:",
            "• वापरकर्त्यांमधील स्थानाधारित मदत/टास्क मॅचिंग सक्षम होईल.",
            "• व्हॉईस‑फर्स्ट टास्क निर्मिती आणि संवाद सुलभ होईल.",
            "• संपर्क मास्किंग, रिपोर्टिंग आणि टास्क समन्वय शक्य होईल.",
          ],
        },
        {
          title: "2. डेटा संकलन आणि जतन",
          items: [
            "• माझे स्थान फक्त अ‍ॅप सक्रिय असताना (Foreground) घेतले जाते आणि जवळच्या “कार्यकर्ता (Karyakarta)” किंवा “नेता (Neta)” शोधण्यासाठी वापरले जाते.",
            "• माझ्या व्हॉईस क्लिप्स (≤30 सेकंद) प्लेबॅक व मॉडरेशनसाठी सुरक्षित सर्व्हरवर अपलोड केल्या जाऊ शकतात.",
            "• माझा फोन नंबर एन्क्रिप्टेड स्वरूपात साठवला जातो आणि अ‍ॅप‑टू‑अ‍ॅप संवादात मास्क केला जातो.",
            "• कायदेशीर व सेवा‑संबंधित गरज इतक्याच कालावधीसाठी डेटा जतन केला जातो.",
          ],
        },
        {
          title: "3. संमती आणि मागे घेणे",
          items: [
            "• या परवानग्या देणे अ‍ॅपच्या कार्यक्षमतेसाठी अत्यावश्यक आहे हे मला माहित आहे.",
            "• मी कोणत्याही वेळी अ‍ॅप अनइंस्टॉल करून किंवा support@oolshik.in वर संपर्क करून माझी संमती मागे घेऊ शकतो/शकते.",
            "• संमती मागे घेतल्यानंतर, कायदेशीर बंधने नसल्यास, माझा वैयक्तिक डेटा वाजवी कालावधीत हटवला किंवा अज्ञात केला जाईल.",
          ],
        },
        {
          title: "4. डेटा सुरक्षा आणि गोपनीयता",
          items: [
            "• माझी माहिती संचयनावर AES‑256 एन्क्रिप्शनने आणि प्रसारणात सुरक्षित HTTPS ने संरक्षित केली जाते.",
            "• Oolshik, Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 नुसार वाजवी सुरक्षा पद्धतींचे पालन करते.",
            "• माझ्या डेटाचा प्रवेश केवळ अधिकृत प्रणाली व कर्मचारी यांपुरताच मर्यादित आहे.",
          ],
        },
        {
          title: "5. वर्तन, सामग्री आणि समुदाय आचारसंहिता",
          items: [
            "• मी राजकीय संवेदनशील, अपमानास्पद, दिशाभूल करणारी किंवा हानिकारक सामग्री पोस्ट/शेअर करणार नाही.",
            "• दिशाभूल (Disinformation), द्वेषपूर्ण भाषण किंवा छळ करण्याचा कोणताही प्रयत्न झाल्यास तात्काळ निलंबन व संबंधित अधिकाऱ्यांकडे नोंद होऊ शकते.",
            "• भारतीय कायदे किंवा समुदाय मानकांचे उल्लंघन करणारी सामग्री Oolshik तपासून काढू शकते.",
          ],
        },
        {
          title: "6. दायित्व आणि भरपाई",
          items: [
            "• Oolshik हा स्वेच्छेने वापरकर्ते जोडणारा पिअर‑टू‑पिअर प्लॅटफॉर्म आहे; ऑफलाइन परस्परसंवादाचा परिणाम/सुरक्षा हमीशीर नाही.",
            "• माझ्या वर्तन व संवादाची जबाबदारी माझीच आहे याला मी सहमत आहे.",
            "• वापरकर्ता परस्परसंवाद, गैरवापर किंवा तांत्रिक त्रुटींमुळे उद्भवलेल्या कोणत्याही तोटा/इजा/वादाबाबत Oolshik व त्याच्या संलग्न संस्था जबाबदार नाहीत.",
          ],
        },
        {
          title: "7. कायदेशीर पालन",
          items: [
            "• Oolshik, Digital Personal Data Protection Act, 2023 आणि इतर लागू भारतीय IT कायद्यांचे पालन करते.",
            "• कोणताही वाद पुणे, महाराष्ट्र (भारत) येथील न्यायालयांच्या अधिकारक्षेत्रात येईल.",
          ],
        },
      ],
      declarationTitle: "✅ वापरकर्ता जाहीरनामा",
      declarationBody:
        "मी ही संमती वाचून समजून घेतली आहे. “आहे संमती” टॅप करून, वरीलप्रमाणे माझ्या डेटाचे संकलन, साठवण व प्रक्रियेस मी स्वेच्छेने संमती देतो/देते.",
    },
  } as const

  // change language on select
  React.useEffect(() => {
    i18n.changeLanguage(lang)
  }, [lang])

  const canContinue = useMemo(() => Boolean(accepted && granted), [accepted, granted])

  // tiny themed checkbox
  const Checkbox = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: colors.palette.neutral400,
        backgroundColor: value ? colors.palette.primary500 : colors.palette.neutral100,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {value ? <Text text="✓" style={{ color: "white" }} /> : null}
    </Pressable>
  )

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]} contentContainerStyle={{ flex: 1 }}>
      {/* Header */}
      <View style={{ padding: spacing.md }}>
        <Text preset="heading" tx="oolshik:consentTitle" />
      </View>

      {/* Body (scrollable content area look, but inside fixed layout) */}
      <View style={{ flex: 1, paddingHorizontal: spacing.md, gap: spacing.lg }}>
        {/* Intro / copy */}
        <View style={{ gap: spacing.xs }}>
          <Text tx="oolshik:locationPermissionMsg" />
        </View>

        {/* Language selection as radio chips */}
        <View>
          <Text text="Language" weight="medium" style={{ marginBottom: spacing.xs }} />
          <RadioGroup
            value={lang}
            onChange={(v) => setLang(v as "mr" | "en")}
            options={[
              { label: "मराठी", value: "mr" },
              { label: "English", value: "en" },
            ]}
            size="md"
            gap={8}
          />
        </View>

        {/* Consent checkbox */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Checkbox value={accepted} onToggle={() => setAccepted((v) => !v)} />
          <Pressable
            onPress={() => {
              setAccepted((v) => !v)
              setShowConsent(true)
            }}
            style={{ flex: 1 }}
          >
            <Text tx="oolshik:consentAgree" />
          </Pressable>
        </View>

        {/* Location permission call-to-action */}
        <View style={{ gap: spacing.xs }}>
          <Button
            tx="oolshik:allow"
            onPress={async () => {
              // request foreground location if hook exposes request(); otherwise this button
              // still communicates intent (granted should flip when permission granted)
              try {
                await request?.()
              } catch {}
            }}
            style={{ width: "100%", paddingVertical: spacing.xs }}
          />
          {/* Small status helper */}
          <Text
            text={granted ? "✓ Location permission granted" : "Location permission required"}
            size="xs"
            style={{ color: granted ? "#16A34A" : colors.palette.neutral600 }}
          />
        </View>
      </View>

      {/* Consent modal */}
      <Modal
        visible={showConsent}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConsent(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center",
            justifyContent: "center",
            padding: spacing.lg,
          }}
        >
          <View
            style={{
              width: "100%",
              maxHeight: "80%",
              borderRadius: 16,
              backgroundColor: "#fff",
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.palette.neutral300,
            }}
          >
            <Text
              text={lang === "mr" ? "संमती" : "Consent"}
              preset="subheading"
              style={{ marginBottom: spacing.xs }}
            />
            <Text text={consentSections[lang].preface} style={{ marginBottom: spacing.sm }} />
            <ScrollView
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingBottom: spacing.md }}
              showsVerticalScrollIndicator
            >
              {consentSections[lang].sections.map((sec, idx) => (
                <View key={idx} style={{ marginBottom: spacing.sm }}>
                  <Text text={sec.title} weight="medium" style={{ marginBottom: 6 }} />
                  {sec.items.map((line, j) => (
                    <View key={j} style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                      {line.trim().startsWith("•") ? (
                        <>
                          <Text text="•" style={{ lineHeight: 20 }} />
                          <Text text={line.replace(/^•\s*/, "")} style={{ flex: 1 }} />
                        </>
                      ) : (
                        <Text text={line} style={{ flex: 1 }} />
                      )}
                    </View>
                  ))}
                </View>
              ))}
              <View
                style={{
                  height: 1,
                  backgroundColor: colors.palette.neutral200,
                  marginVertical: spacing.xs,
                }}
              />
              <View style={{ marginTop: spacing.xs }}>
                <Text
                  text={consentSections[lang].declarationTitle}
                  weight="bold"
                  style={{ marginBottom: 6 }}
                />
                <Text text={consentSections[lang].declarationBody} />
              </View>
            </ScrollView>

            <Button
              text={lang === "mr" ? "आहे संमती" : "Ok"}
              onPress={() => {
                setAccepted(true)
                setShowConsent(false)
              }}
              style={{ width: "100%", marginTop: spacing.sm, paddingVertical: spacing.xs }}
            />
          </View>
        </View>
      </Modal>
      {/* Bottom fixed primary CTA */}
      <View
        style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md }}
      >
        <Button
          tx="oolshik:home"
          onPress={() => {
            setOnboardingComplete("true")
            navigation.replace("OolshikHome")
          }}
          disabled={!canContinue}
          style={{ width: "100%", paddingVertical: spacing.xs, opacity: canContinue ? 1 : 0.6 }}
        />
      </View>
    </Screen>
  )
}
