import { Pressable, View } from "react-native"
import { useTranslation } from "react-i18next"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

import { $authModeButton, $authModeButtonActive, $authModeRow } from "./loginStyles"

type AuthMode = "google" | "phone"

interface AuthModeToggleProps {
  authMode: AuthMode
  onModeChange: (mode: AuthMode) => void
}

export function AuthModeToggle({ authMode, onModeChange }: AuthModeToggleProps) {
  const { t } = useTranslation()
  const { themed, theme } = useAppTheme()
  const { colors } = theme

  return (
    <View style={themed($authModeRow)}>
      <Pressable
        accessibilityRole="button"
        onPress={() => onModeChange("google")}
        style={[
          themed($authModeButton),
          authMode === "google" ? themed($authModeButtonActive) : undefined,
        ]}
      >
        <Text
          text={t("oolshik:login.continueWithGoogle")}
          weight="bold"
          style={authMode === "google" ? { color: colors.palette.neutral100 } : undefined}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => onModeChange("phone")}
        style={[
          themed($authModeButton),
          authMode === "phone" ? themed($authModeButtonActive) : undefined,
        ]}
      >
        <Text
          text={t("oolshik:login.continueWithPhone")}
          weight="bold"
          style={authMode === "phone" ? { color: colors.palette.neutral100 } : undefined}
        />
      </Pressable>
    </View>
  )
}
