import React from "react"
import { View } from "react-native"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"

type ContactSectionProps = {
  visible: boolean
  title: string
  displayPhone: string
  isRevealed: boolean
  revealLoading: boolean
  canCall: boolean
  onReveal: () => void
  onCall: () => void
  callLabel: string
  showLabel: string
  neutral100: string
  neutral300: string
  neutral700: string
  spacingXs: number
  spacingSm: number
}

export function ContactSection(props: ContactSectionProps) {
  if (!props.visible) return null

  return (
    <View
      style={{
        gap: props.spacingXs,
        padding: props.spacingSm,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: props.neutral300,
        backgroundColor: props.neutral100,
      }}
    >
      <Text text={props.title} weight="medium" style={{ color: props.neutral700 }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: props.spacingSm }}>
        <Text text={props.displayPhone} weight="bold" style={{ flex: 1, color: props.neutral700 }} />
        {props.isRevealed ? (
          <Button
            text={props.callLabel}
            onPress={props.onCall}
            disabled={!props.canCall}
            style={{ paddingVertical: props.spacingXs }}
          />
        ) : (
          <Button
            text={props.revealLoading ? "..." : props.showLabel}
            onPress={props.onReveal}
            style={{ paddingVertical: props.spacingXs }}
          />
        )}
      </View>
    </View>
  )
}
