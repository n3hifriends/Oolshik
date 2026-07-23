import { loadString, saveString } from "@/utils/storage"

const PROMPT_SHOWN_KEY_PREFIX = "task_feedback_prompt_shown_v1"
const LATER_ALERT_SEEN_KEY_PREFIX = "feedback_later_alert_seen_v1"

export type FeedbackPromptEvent = "creation" | "completion"

function resolveScope(userId?: string | null): string {
  const normalized = String(userId ?? "").trim()
  return normalized.length > 0 ? normalized : "device"
}

// Per-task, per-event — each task gets its own creation/completion prompt exactly once.
export function hasShownFeedbackPrompt(taskId: string, event: FeedbackPromptEvent): boolean {
  return loadString(`${PROMPT_SHOWN_KEY_PREFIX}:${taskId}:${event}`) === "1"
}

export function markFeedbackPromptShown(taskId: string, event: FeedbackPromptEvent): void {
  saveString(`${PROMPT_SHOWN_KEY_PREFIX}:${taskId}:${event}`, "1")
}

// Single global flag (per user) — the "you can give feedback later from Profile" alert is
// shown at most once ever, regardless of how many prompts get skipped afterwards.
export function hasSeenFeedbackLaterAlert(userId?: string | null): boolean {
  return loadString(`${LATER_ALERT_SEEN_KEY_PREFIX}:${resolveScope(userId)}`) === "1"
}

export function markFeedbackLaterAlertSeen(userId?: string | null): void {
  saveString(`${LATER_ALERT_SEEN_KEY_PREFIX}:${resolveScope(userId)}`, "1")
}
