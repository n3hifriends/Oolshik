import { useEffect, useMemo, useState } from "react"
import { AppState } from "react-native"
import {
  formatCountdown,
  formatDetailedCountdown,
} from "@/screens/task-detail/helpers/taskDetailFormatters"

export const REASSIGN_SLA_SECONDS = 420

type UseTaskTimersInput = {
  rawStatus?: string
  helperAcceptedAt?: string | null
  pendingAuthExpiresAt?: string | null
  completionConfirmationExpiresAt?: string | null
}

export function useTaskTimers({
  rawStatus,
  helperAcceptedAt,
  pendingAuthExpiresAt,
  completionConfirmationExpiresAt,
}: UseTaskTimersInput) {
  const [nowMs, setNowMs] = useState(Date.now())

  const helperAcceptedAtMs = helperAcceptedAt ? new Date(helperAcceptedAt).getTime() : null
  const pendingAuthExpiresAtMs = pendingAuthExpiresAt ? new Date(pendingAuthExpiresAt).getTime() : null
  const completionConfirmationExpiresAtMs = completionConfirmationExpiresAt
    ? new Date(completionConfirmationExpiresAt).getTime()
    : null

  const reassignAvailableAtMs = helperAcceptedAtMs
    ? helperAcceptedAtMs + REASSIGN_SLA_SECONDS * 1000
    : null

  const msUntilReassign = reassignAvailableAtMs ? Math.max(0, reassignAvailableAtMs - nowMs) : null
  const msUntilAuthExpiry = pendingAuthExpiresAtMs ? Math.max(0, pendingAuthExpiresAtMs - nowMs) : null
  const msUntilCompletionConfirmation = completionConfirmationExpiresAtMs
    ? Math.max(0, completionConfirmationExpiresAtMs - nowMs)
    : null

  useEffect(() => {
    const needsReassignTimer = reassignAvailableAtMs && rawStatus === "ASSIGNED"
    const needsAuthTimer = pendingAuthExpiresAtMs && rawStatus === "PENDING_AUTH"
    const needsConfirmationTimer =
      completionConfirmationExpiresAtMs && rawStatus === "WORK_DONE_PENDING_CONFIRMATION"
    if (!needsReassignTimer && !needsAuthTimer && !needsConfirmationTimer) return

    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        setNowMs(Date.now())
      }
    })
    return () => {
      clearInterval(timer)
      appStateSub.remove()
    }
  }, [rawStatus, reassignAvailableAtMs, pendingAuthExpiresAtMs, completionConfirmationExpiresAtMs])

  const reassignCountdown = useMemo(() => formatCountdown(msUntilReassign), [msUntilReassign])
  const authCountdown = useMemo(() => formatCountdown(msUntilAuthExpiry), [msUntilAuthExpiry])
  const completionConfirmationCountdown = useMemo(
    () => formatDetailedCountdown(msUntilCompletionConfirmation),
    [msUntilCompletionConfirmation],
  )
  const authExpired = msUntilAuthExpiry !== null && msUntilAuthExpiry <= 0
  const completionConfirmationExpired =
    msUntilCompletionConfirmation !== null && msUntilCompletionConfirmation <= 0

  return {
    msUntilReassign,
    msUntilAuthExpiry,
    msUntilCompletionConfirmation,
    reassignCountdown,
    authCountdown,
    completionConfirmationCountdown,
    authExpired,
    completionConfirmationExpired,
  }
}
