import React from "react"
import { View, StyleSheet } from "react-native"
import { Text } from "@/components/Text"

export function RatingBadge({ value }: { value?: number | null }) {
  if (value == null) return null
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{value.toFixed(1)} ⭐️</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 15,
  },
  text: { color: "#fff", fontWeight: "600", fontSize: 12 },
})
