import React, { useMemo } from "react"
import { View, StyleSheet } from "react-native"
import Slider from "@react-native-community/slider"
import { Text } from "@/components/Text"

// Map value (0..5) → emoji + label
function getFace(v: number) {
  if (v < 1) return { emoji: "😡", label: "oolshik:ratingBad" }
  if (v < 2) return { emoji: "🙁", label: "oolshik:ratingPoor" }
  if (v < 3) return { emoji: "😐", label: "oolshik:ratingOkay" }
  if (v < 4) return { emoji: "🙂", label: "oolshik:ratingGood" }
  return { emoji: "😄", label: "oolshik:ratingGreat" }
}
const SLIDER_COLOR = "#FF6B2C"

export type SmileySliderProps = {
  disabled?: boolean
  value: number
  onChange: (v: number) => void
  onSlidingComplete?: (v: number) => void
}

export function SmileySlider({ disabled, value, onChange, onSlidingComplete }: SmileySliderProps) {
  const face = useMemo(() => getFace(value), [value])

  return (
    <View style={styles.wrapper}>
      <View style={styles.faceRow}>
        <Text style={styles.faceEmoji}>{face.emoji}</Text>
        <Text tx={face.label} style={styles.faceLabel} />
      </View>

      <View style={styles.sliderRow}>
        <Text style={styles.edgeEmoji}>😡</Text>
        <View style={{ flex: 1 }}>
          <Slider
            disabled={disabled}
            value={value}
            onValueChange={onChange}
            onSlidingComplete={onSlidingComplete}
            minimumValue={0}
            maximumValue={5}
            step={1}
            minimumTrackTintColor={SLIDER_COLOR} // green-ish
            maximumTrackTintColor="#d1d5db" // gray-300
            thumbTintColor={SLIDER_COLOR} // emerald-500
            accessibilityLabel="Rate your experience"
          />
        </View>
        <Text style={styles.edgeEmoji}>😄</Text>
      </View>

      <Text tx="oolshik:leftRightExperience" style={styles.helperText} />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { gap: 8 },
  faceRow: { alignItems: "center", justifyContent: "center" },
  faceEmoji: { fontSize: 40, lineHeight: 44 },
  faceLabel: { marginTop: 4, fontSize: 14, opacity: 0.7 },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  edgeEmoji: { width: 24, textAlign: "center" },
  helperText: { marginTop: 4, fontSize: 12, opacity: 0.6, textAlign: "center" },
})
