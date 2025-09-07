import React from "react"
import { Pressable, View } from "react-native"
import { Text } from "@/components/Text"

export type ViewMode = "forYou" | "mine"

export const Segmented: React.FC<{ value: ViewMode; onChange: (v: ViewMode) => void }> = ({
  value,
  onChange,
}) => {
  const tabs: { key: ViewMode; tx: string; a11y: string }[] = [
    { key: "forYou", tx: "oolshik:tabForYou", a11y: "For you" },
    { key: "mine", tx: "oolshik:tabMyRequests", a11y: "My requests" },
  ]
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: "#edf0f3ff",
        borderRadius: 12,
        padding: 4,
        gap: 4,
      }}
    >
      {tabs.map((t) => {
        const active = value === t.key
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={t.a11y}
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: active ? "#111827" : "transparent",
            }}
          >
            <Text tx={t.tx} style={{ fontWeight: "700", color: active ? "#fff" : "#111827" }} />
          </Pressable>
        )
      })}
    </View>
  )
}
