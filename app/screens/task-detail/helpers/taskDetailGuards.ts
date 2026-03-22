export type TaskDetailRawStatus =
  | "DRAFT"
  | "PENDING"
  | "PENDING_AUTH"
  | "ASSIGNED"
  | "WORK_DONE_PENDING_CONFIRMATION"
  | "REVIEW_REQUIRED"
  | "COMPLETED"
  | "OPEN"
  | "CANCELLED"
  | "CANCELED"
  | string
  | undefined
  | null

export type NormalizedTaskStatus =
  | "PENDING"
  | "PENDING_AUTH"
  | "ASSIGNED"
  | "WORK_DONE_PENDING_CONFIRMATION"
  | "REVIEW_REQUIRED"
  | "COMPLETED"
  | "CANCELLED"
  | "UNKNOWN"

export function normalizeTaskStatus(rawStatus: TaskDetailRawStatus): NormalizedTaskStatus {
  switch (rawStatus) {
    case "OPEN":
      return "PENDING"
    case "PENDING_AUTH":
      return "PENDING_AUTH"
    case "WORK_DONE_PENDING_CONFIRMATION":
      return "WORK_DONE_PENDING_CONFIRMATION"
    case "REVIEW_REQUIRED":
      return "REVIEW_REQUIRED"
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED"
    case "PENDING":
    case "ASSIGNED":
    case "COMPLETED":
      return rawStatus
    default:
      return "UNKNOWN"
  }
}

export function isRequesterForTask(requesterId?: string, userId?: string) {
  return !!requesterId && !!userId && requesterId === userId
}

export function isHelperForTask(helperId?: string | null, userId?: string) {
  return !!helperId && !!userId && helperId === userId
}

export function isPendingHelperForTask(pendingHelperId?: string | null, userId?: string) {
  return !!pendingHelperId && !!userId && pendingHelperId === userId
}
