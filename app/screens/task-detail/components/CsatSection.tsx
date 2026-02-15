import React from "react"
import { Pressable, View } from "react-native"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import type { SubmittedFeedbackSnapshot } from "@/features/feedback/storage/feedbackQueue"

type CsatSectionProps = {
  visible: boolean
  csatSubmitted: boolean
  submittedCsat: SubmittedFeedbackSnapshot | null
  csatRating: number
  csatTag: string | null
  csatSubmitting: boolean
  tags: string[]
  onSelectRating: (value: number) => void
  onToggleTag: (tag: string) => void
  onSubmitCsat: () => void
  title: string
  alreadySubmittedThanks: string
  ratingSubmittedValueText?: string
  tagSubmittedText?: string
  commentSubmittedText?: string
  quickTagOptional: string
  sendFeedbackLabel: string
  submittingLabel: string
  rateNumberA11y: (value: number) => string
  tagA11y: (tag: string) => string
  primary: string
  primary100: string
  neutral100: string
  neutral300: string
  neutral600: string
  neutral700: string
  spacingXxs: number
  spacingXs: number
  spacingSm: number
}

export function CsatSection(props: CsatSectionProps) {
  if (!props.visible) return null

  return (
    <View
      style={{
        gap: props.spacingSm,
        paddingHorizontal: props.spacingSm,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: props.neutral300,
        backgroundColor: props.neutral100,
        marginHorizontal: 16,
        marginVertical: 5,
        paddingBottom: 16,
        paddingTop: 12,
      }}
    >
      <Text text={props.title} preset="subheading" />
      {props.csatSubmitted ? (
        <View style={{ gap: props.spacingXxs }}>
          <Text text={props.alreadySubmittedThanks} size="xs" style={{ color: props.neutral600 }} />
          {props.ratingSubmittedValueText ? <Text text={props.ratingSubmittedValueText} size="xs" /> : null}
          {props.tagSubmittedText ? <Text text={props.tagSubmittedText} size="xs" /> : null}
          {props.commentSubmittedText ? <Text text={props.commentSubmittedText} size="xs" /> : null}
        </View>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: props.spacingXs }}>
            {[1, 2, 3, 4, 5].map((val) => {
              const active = Math.round(props.csatRating) === val
              return (
                <Pressable
                  key={`csat-${val}`}
                  onPress={() => props.onSelectRating(val)}
                  accessibilityRole="button"
                  accessibilityLabel={props.rateNumberA11y(val)}
                  style={({ pressed }) => ({
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: active ? props.primary : props.neutral300,
                    backgroundColor: active ? props.primary100 : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Text text={String(val)} weight="medium" />
                </Pressable>
              )
            })}
          </View>

          <View style={{ gap: props.spacingXs }}>
            <Text text={props.quickTagOptional} size="xs" style={{ color: props.neutral600 }} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: props.spacingXs }}>
              {props.tags.map((tag) => {
                const active = props.csatTag === tag
                return (
                  <Pressable
                    key={tag}
                    onPress={() => props.onToggleTag(tag)}
                    style={({ pressed }) => ({
                      paddingHorizontal: props.spacingSm,
                      paddingVertical: 2,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: active ? props.primary : props.neutral300,
                      backgroundColor: active ? props.primary100 : "transparent",
                      opacity: pressed ? 0.7 : 1,
                    })}
                    accessibilityRole="button"
                    accessibilityLabel={props.tagA11y(tag)}
                  >
                    <Text text={tag} size="xs" style={{ color: active ? props.primary : props.neutral700 }} />
                  </Pressable>
                )
              })}
            </View>
          </View>

          <Button
            text={props.csatSubmitting ? props.submittingLabel : props.sendFeedbackLabel}
            onPress={props.onSubmitCsat}
            disabled={props.csatSubmitting}
            style={{ paddingVertical: props.spacingXs }}
          />
        </>
      )}
    </View>
  )
}
