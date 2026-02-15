import React from "react"
import { Modal, Pressable, View } from "react-native"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"
import type { ReasonModalState } from "@/screens/task-detail/types"

type ReasonItem = {
  code: string
  label: string
}

type ReasonModalProps = {
  reasonModal: ReasonModalState
  title: string
  reasons: ReasonItem[]
  addShortNotePlaceholder: string
  goBackLabel: string
  confirmLabel: string
  actionLoading: boolean
  primary: string
  background: string
  neutral100: string
  neutral300: string
  primary100: string
  spacingSm: number
  onClose: () => void
  onConfirm: () => void
  onSelectReason: (code: string) => void
  onChangeReasonText: (value: string) => void
}

export function ReasonModalSection(props: ReasonModalProps) {
  return (
    <Modal transparent visible={props.reasonModal.visible} animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: props.background,
            borderRadius: 16,
            padding: 16,
            gap: props.spacingSm,
          }}
        >
          <Text text={props.title} preset="subheading" />
          {props.reasons.map((reason) => {
            const selected = props.reasonModal.reasonCode === reason.code
            return (
              <Pressable
                key={reason.code}
                onPress={() => props.onSelectReason(reason.code)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: selected ? props.primary : props.neutral300,
                  backgroundColor: selected ? props.primary100 : props.neutral100,
                }}
              >
                <Text text={reason.label} />
              </Pressable>
            )
          })}

          {props.reasonModal.reasonCode === "OTHER" ? (
            <TextField
              value={props.reasonModal.reasonText}
              onChangeText={props.onChangeReasonText}
              placeholder={props.addShortNotePlaceholder}
              containerStyle={{ marginBottom: 0 }}
            />
          ) : null}

          <View style={{ flexDirection: "row", gap: props.spacingSm }}>
            <Button text={props.goBackLabel} onPress={props.onClose} style={{ flex: 1 }} />
            <Button
              text={props.actionLoading ? "..." : props.confirmLabel}
              onPress={props.onConfirm}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </View>
    </Modal>
  )
}
