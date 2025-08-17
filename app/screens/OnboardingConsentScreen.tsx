import React, { useMemo, useState } from "react"
import { View, Pressable } from "react-native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { RadioGroup } from "@/components/RadioGroup"
import { useAppTheme } from "@/theme/context"
import { useTranslation } from "react-i18next"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"

export default function OnboardingConsentScreen({ navigation }: any) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme
  const { i18n } = useTranslation()

  // location hook (assumes it exposes `granted` and maybe a `request` function)
  const { granted, request } = useForegroundLocation() as {
    granted?: boolean
    request?: () => Promise<void>
  }

  const [accepted, setAccepted] = useState(false)
  const [lang, setLang] = useState<"mr" | "en">(i18n.language === "mr" ? "mr" : "en")

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
          <Pressable onPress={() => setAccepted((v) => !v)} style={{ flex: 1 }}>
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

      {/* Bottom fixed primary CTA */}
      <View
        style={{ position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md }}
      >
        <Button
          tx="oolshik:home"
          onPress={() => navigation.replace("OolshikHome")}
          disabled={!canContinue}
          style={{ width: "100%", paddingVertical: spacing.xs, opacity: canContinue ? 1 : 0.6 }}
        />
      </View>
    </Screen>
  )
}
