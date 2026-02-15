import { useEffect, useMemo, useState } from "react"
import { formatCountdown } from "@/screens/task-detail/helpers/taskDetailFormatters"

export const REASSIGN_SLA_SECONDS = 420

type UseTaskTimersInput = {
  rawStatus?: string
  helperAcceptedAt?: string | null
  pendingAuthExpiresAt?: string | null
}

export function useTaskTimers({ rawStatus, helperAcceptedAt, pendingAuthExpiresAt }: UseTaskTimersInput) {
  const [nowMs, setNowMs] = useState(Date.now())

  const helperAcceptedAtMs = helperAcceptedAt ? new Date(helperAcceptedAt).getTime() : null
  const pendingAuthExpiresAtMs = pendingAuthExpiresAt ? new Date(pendingAuthExpiresAt).getTime() : null

  const reassignAvailableAtMs = helperAcceptedAtMs
    ? helperAcceptedAtMs + REASSIGN_SLA_SECONDS * 1000
    : null

  const msUntilReassign = reassignAvailableAtMs ? Math.max(0, reassignAvailableAtMs - nowMs) : null
  const msUntilAuthExpiry = pendingAuthExpiresAtMs ? Math.max(0, pendingAuthExpiresAtMs - nowMs) : null

  useEffect(() => {
    const needsReassignTimer = reassignAvailableAtMs && rawStatus === "ASSIGNED"
    const needsAuthTimer = pendingAuthExpiresAtMs && rawStatus === "PENDING_AUTH"
    if (!needsReassignTimer && !needsAuthTimer) return

    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [rawStatus, reassignAvailableAtMs, pendingAuthExpiresAtMs])

  const reassignCountdown = useMemo(() => formatCountdown(msUntilReassign), [msUntilReassign])
  const authCountdown = useMemo(() => formatCountdown(msUntilAuthExpiry), [msUntilAuthExpiry])
  const authExpired = msUntilAuthExpiry !== null && msUntilAuthExpiry <= 0

  return {
    msUntilReassign,
    msUntilAuthExpiry,
    reassignCountdown,
    authCountdown,
    authExpired,
  }
}
