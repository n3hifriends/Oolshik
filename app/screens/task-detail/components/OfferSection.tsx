import React from "react"
import { View } from "react-native"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { TextField } from "@/components/TextField"

type OfferSectionProps = {
  title: string
  currentOfferText: string
  canEditOffer: boolean
  offerInput: string
  onOfferInputChange: (value: string) => void
  onSaveOffer: () => void
  offerSaving: boolean
  saveLabel: string
  savingLabel: string
  setOfferAmountPlaceholder: string
  offerNotice: string | null
  neutral100: string
  neutral300: string
  neutral600: string
  neutral700: string
  spacingXs: number
  spacingSm: number
}

export function OfferSection(props: OfferSectionProps) {
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
      <Text text={props.currentOfferText} size="sm" style={{ color: props.neutral700 }} />
      {props.canEditOffer ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: props.spacingXs }}>
          <View style={{ flex: 1 }}>
            <TextField
              value={props.offerInput}
              onChangeText={props.onOfferInputChange}
              placeholder={props.setOfferAmountPlaceholder}
              keyboardType="decimal-pad"
            />
          </View>
          <Button
            text={props.offerSaving ? props.savingLabel : props.saveLabel}
            onPress={props.onSaveOffer}
            disabled={props.offerSaving}
            style={{ minWidth: 92 }}
          />
        </View>
      ) : null}
      {props.offerNotice ? <Text text={props.offerNotice} size="xs" style={{ color: props.neutral600 }} /> : null}
    </View>
  )
}
