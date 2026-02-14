import React from "react"
import { Pressable } from "react-native"
import { useTranslation } from "react-i18next"
import { Text } from "@/components/Text"

type Status = "OPEN" | "PENDING_AUTH" | "ASSIGNED" | "COMPLETED" | "CANCELLED"
const STATUS_COLORS: Record<Status, string> = {
  OPEN: "#0EA5E9",
  PENDING_AUTH: "#2563EB",
  ASSIGNED: "#F59E0B",
  COMPLETED: "#10B981",
  CANCELLED: "#EF4444",
}
const STATUS_LABEL_KEYS: Record<Status, string> = {
  OPEN: "oolshik:status.open",
  PENDING_AUTH: "oolshik:status.pendingAuth",
  ASSIGNED: "oolshik:status.assigned",
  COMPLETED: "oolshik:status.completed",
  CANCELLED: "oolshik:status.cancelled",
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
}) => {
  const { t } = useTranslation()
  const label = t(STATUS_LABEL_KEYS[s] as any)

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={t("oolshik:taskCard.filterStatusA11y", { status: label })}
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
        text={label}
        size="xxs"
        style={{ color: active ? "#fff" : STATUS_COLORS[s] }}
      />
    </Pressable>
  )
}
