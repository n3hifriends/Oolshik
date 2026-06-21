import React from "react"
import { Pressable } from "react-native"
import { useTranslation } from "react-i18next"
import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"
import { getStatusColors } from "@/theme/statusColors"

type Status =
  | "OPEN"
  | "PENDING_AUTH"
  | "ASSIGNED"
  | "WORK_DONE_PENDING_CONFIRMATION"
  | "REVIEW_REQUIRED"
  | "COMPLETED"
  | "CANCELLED"

const STATUS_LABEL_KEYS: Record<Status, string> = {
  OPEN: "oolshik:status.open",
  PENDING_AUTH: "oolshik:status.pendingAuth",
  ASSIGNED: "oolshik:status.assigned",
  WORK_DONE_PENDING_CONFIRMATION: "oolshik:status.waitingConfirmation",
  REVIEW_REQUIRED: "oolshik:status.reviewRequired",
  COMPLETED: "oolshik:status.completed",
  CANCELLED: "oolshik:status.cancelled",
}

export const StatusChip: React.FC<{ s: Status; active: boolean; onPress: () => void }> = ({
  s,
  active,
  onPress,
}) => {
  const { t } = useTranslation()
  const { theme } = useAppTheme()
  const label = t(STATUS_LABEL_KEYS[s] as any)
  const { vivid, softBg, fg, activeFg } = getStatusColors(s, theme.isDark)

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
        borderColor: vivid,
        backgroundColor: active ? vivid : softBg,
      }}
    >
      <Text
        text={label}
        size="xxs"
        style={{ color: active ? activeFg : fg }}
      />
    </Pressable>
  )
}
