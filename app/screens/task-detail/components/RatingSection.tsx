import React from "react"
import { View } from "react-native"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { SmileySlider } from "@/components/SmileySlider"

type RatingSectionProps = {
  visible: boolean
  myRating: number | null
  otherPartyRating: number | null
  isRequester: boolean
  rating: number
  setRating: (value: number) => void
  onSubmitRating: () => void
  ratingSubmitting: boolean
  titleRateHelper: string
  titleRateRequester: string
  submitLabel: string
  submittingLabel: string
  youRatedText: string
  helperRatedYouText: string
  requesterRatedYouText: string
  neutral100: string
  neutral300: string
  spacingMd: number
  spacingSm: number
  spacingXs: number
}

export function RatingSection(props: RatingSectionProps) {
  if (!props.visible) return null

  return (
    <View
      style={{
        gap: props.spacingMd,
        paddingHorizontal: props.spacingSm,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: props.neutral300,
        backgroundColor: props.neutral100,
        marginHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 12,
      }}
    >
      {props.myRating == null ? (
        <Text
          text={props.isRequester ? props.titleRateHelper : props.titleRateRequester}
          preset="subheading"
        />
      ) : null}

      {props.myRating == null ? (
        <>
          <SmileySlider disabled={false} value={props.rating} onChange={props.setRating} />
          <Text style={{ textAlign: "center", marginTop: 6, opacity: 0.6 }}>{props.rating.toFixed(1)} / 5.0</Text>
          <Button
            text={props.ratingSubmitting ? props.submittingLabel : props.submitLabel}
            onPress={props.onSubmitRating}
            style={{ paddingVertical: props.spacingXs }}
            disabled={props.ratingSubmitting}
          />
        </>
      ) : (
        <Text text={props.youRatedText} weight="medium" />
      )}

      {props.otherPartyRating != null ? (
        <Text text={props.isRequester ? props.helperRatedYouText : props.requesterRatedYouText} size="xs" />
      ) : null}
    </View>
  )
}
