import React from "react"
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  Platform,
  AccessibilityInfo,
} from "react-native"
import { useTranslation } from "react-i18next"

import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

let Portal: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const mod = require("react-native-portal")
  const candidate = mod?.Portal ?? mod?.default ?? mod
  const isLegacy = !!(candidate && (candidate as any).childContextTypes)
  Portal = isLegacy ? null : candidate
} catch {
  Portal = null
}
const ResolvedPortal =
  typeof Portal === "function"
    ? Portal
    : typeof Portal?.Portal === "function"
      ? Portal.Portal
      : null

type AlertActionTone = "default" | "primary" | "destructive"
type AlertAction = {
  text: string
  onPress?: () => void
  tone?: AlertActionTone
  testID?: string
}

export type AlertDialogProps = {
  visible: boolean
  title?: string
  message?: string
  actions?: AlertAction[]
  onDismiss?: () => void
  dismissOnBackdropPress?: boolean
  testID?: string
}

export function AlertDialog(props: AlertDialogProps) {
  const {
    visible,
    title,
    message,
    actions = [],
    onDismiss,
    dismissOnBackdropPress = true,
    testID,
  } = props
  const { theme } = useAppTheme()
  const { t } = useTranslation()

  const palette = {
    cardBg: theme.isDark ? "rgba(21,21,25,0.96)" : "rgba(255,255,255,0.98)",
    border: theme.isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
    scrim: theme.isDark ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.38)",
    shadow: "#000",
  }

  const renderButtons = () => {
    const items = actions.length
      ? actions
      : [{ text: t("common:ok", { defaultValue: "OK" }), tone: "primary" as AlertActionTone }]
    const inline = items.length <= 2
    return (
      <View style={[styles.buttonRow, !inline && styles.buttonColumn]}>
        {items.map((action, idx) => {
          const tone = action.tone ?? "default"
          const preset =
            tone === "destructive" ? "filled" : tone === "primary" ? "filled" : "default"
          const colorOverride =
            tone === "destructive"
              ? theme.colors.error
              : tone === "primary"
                ? theme.colors.tint
                : undefined
          return (
            <Button
              key={`${action.text}-${idx}`}
              text={action.text}
              onPress={() => {
                action.onPress?.()
                onDismiss?.()
              }}
              testID={action.testID}
              preset={preset as any}
              style={[
                styles.button,
                inline && styles.buttonInline,
                colorOverride && { backgroundColor: colorOverride },
              ]}
              textStyle={colorOverride ? { color: theme.colors.background } : undefined}
              accessibilityRole="button"
            />
          )
        })}
      </View>
    )
  }

  const dialog = (
    <View
      style={[StyleSheet.absoluteFill, styles.centered]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]}
        onPress={() => {
          if (dismissOnBackdropPress) onDismiss?.()
        }}
        accessibilityLabel={t("common:cancel", { defaultValue: "Close dialog" })}
        accessibilityRole="button"
      />
      <View
        style={[
          styles.card,
          {
            backgroundColor: palette.cardBg,
            borderColor: palette.border,
            shadowColor: palette.shadow,
          },
        ]}
        accessibilityViewIsModal
        testID={testID}
      >
        <View style={[styles.accent, { backgroundColor: theme.colors.tint }]} />
        {!!title && (
          <Text
            text={title}
            preset="heading"
            style={{ marginBottom: 6, color: theme.colors.text }}
            numberOfLines={2}
          />
        )}
        {!!message && (
          <Text
            preset="subheading"
            text={message}
            // Keep message line height from preset to avoid clipping complex scripts (e.g. Marathi).
            style={{ marginBottom: 18, color: theme.colors.textDim }}
          />
        )}
        {renderButtons()}
      </View>
    </View>
  )

  if (!visible) return null

  // announce dialog for accessibility
  if (Platform.OS === "android") {
    const announcementText = title ?? message ?? ""
    if (announcementText) {
      AccessibilityInfo.announceForAccessibility?.(announcementText)
    }
  }

  return ResolvedPortal ? (
    <ResolvedPortal>{dialog}</ResolvedPortal>
  ) : (
    <Modal transparent visible animationType="fade" onRequestClose={onDismiss}>
      {dialog}
    </Modal>
  )
}

const styles = StyleSheet.create({
  button: {
    marginTop: 10,
  } as ViewStyle,
  buttonInline: {
    flex: 1,
  } as ViewStyle,
  buttonColumn: {
    flexDirection: "column",
  } as ViewStyle,
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  } as ViewStyle,
  card: {
    minWidth: 280,
    maxWidth: "92%",
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingTop: 18,
    shadowOpacity: 0.22,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  } as ViewStyle,
  centered: {
    alignItems: "center",
    justifyContent: "center",
  } as ViewStyle,
  accent: {
    height: 4,
    borderRadius: 999,
    marginBottom: 12,
    width: 54,
    alignSelf: "center",
    opacity: 0.85,
  } as ViewStyle,
})

// import { AlertDialog } from "@/components/AlertDialog"

// // ...
// const [show, setShow] = useState(false)

// <AlertDialog
//   visible={show}
//   title="Delete task?"
//   message="This action cannot be undone."
//   onDismiss={() => setShow(false)}
//   actions={[
//     { text: "Cancel", tone: "default" },
//     { text: "Delete", tone: "destructive", onPress: handleDelete },
//   ]}
// />
