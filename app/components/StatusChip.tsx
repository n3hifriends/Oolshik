import React from "react"
import { Pressable } from "react-native"
import { Text } from "@/components/Text"

type Status = "OPEN" | "PENDING_AUTH" | "ASSIGNED" | "COMPLETED" | "CANCELLED"
const STATUS_COLORS: Record<Status, string> = {
  OPEN: "#0EA5E9",
  PENDING_AUTH: "#2563EB",
  ASSIGNED: "#F59E0B",
  COMPLETED: "#10B981",
  CANCELLED: "#EF4444",
}
const STATUS_LABELS: Record<Status, string> = {
  OPEN: "Open",
  PENDING_AUTH: "Awaiting approval",
  ASSIGNED: "Assigned",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
}
const STATUS_BG: Record<Status, string> = {
  OPEN: "rgba(14,165,233,0.10)",
  PENDING_AUTH: "rgba(37,99,235,0.10)",
  ASSIGNED: "rgba(245,158,11,0.10)",
  COMPLETED: "rgba(16,185,129,0.10)",
  CANCELLED: "rgba(239,68,68,0.12)",
}

export const StatusChip: React.FC<{ s: Status; active: boolean; onPress: () => void }> = ({
  s,
  active,
  onPress,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    accessibilityLabel={`Filter ${s}`}
    style={{
      paddingVertical: 4,
      paddingHorizontal: 7,
      borderRadius: 499,
      borderWidth: 1,
      borderColor: STATUS_COLORS[s],
      backgroundColor: active ? STATUS_COLORS[s] : STATUS_BG[s],
    }}
  >
    <Text
      text={STATUS_LABELS[s]}
      size="xxs"
      style={{ color: active ? "#fff" : STATUS_COLORS[s] }}
    />
  </Pressable>
)
