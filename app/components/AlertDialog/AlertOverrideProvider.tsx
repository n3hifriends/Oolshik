import React, { useEffect, useRef, useState } from "react"
import { Alert, AlertButton, AlertOptions, AlertType } from "react-native"
import i18n from "i18next"

import { AlertDialog, AlertDialogProps } from "./AlertDialog"

type AlertState = AlertDialogProps

function mapButtons(buttons?: AlertButton[]): NonNullable<AlertState["actions"]> {
  const localizedOk = i18n.t("common:ok", { defaultValue: "OK" })
  const normalized = buttons?.length ? buttons : [{ text: localizedOk }]
  return normalized.map((btn) => ({
    text: btn.text ?? localizedOk,
    onPress: btn.onPress,
    tone:
      btn.style === "destructive" ? "destructive" : btn.style === "cancel" ? "default" : "primary",
    testID: btn.style === "cancel" ? "alert-cancel" : undefined,
  }))
}

export function AlertOverrideProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AlertState>({ visible: false, actions: [] })
  const originalAlertRef = useRef(Alert.alert)

  useEffect(() => {
    const hide = () => setState((prev) => ({ ...prev, visible: false }))

    const override: typeof Alert.alert = (
      title?: string,
      message?: string,
      buttons?: AlertButton[],
      options?: AlertOptions,
      _type?: AlertType,
    ) => {
      const actions = mapButtons(buttons).map((btn) => ({
        ...btn,
        onPress: () => {
          hide()
          btn.onPress?.()
        },
      }))

      setState({
        visible: true,
        title,
        message,
        actions,
        dismissOnBackdropPress: options?.cancelable !== false,
        onDismiss: () => {
          hide()
          options?.onDismiss?.()
        },
        // RN types don't expose accessibilityLabel on options; keep runtime support
        testID: (options as any)?.accessibilityLabel,
      })
    }

    // override globally so existing Alert.alert calls render our dialog
    ;(Alert as any).alert = override
    return () => {
      ;(Alert as any).alert = originalAlertRef.current
    }
  }, [])

  return (
    <>
      {children}
      <AlertDialog {...state} />
    </>
  )
}
