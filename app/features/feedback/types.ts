export type FeedbackType = "BUG" | "FEATURE" | "CSAT" | "SAFETY" | "OTHER"
export type FeedbackContextType = "APP" | "TASK" | "SCREEN"

export type FeedbackPayload = {
  feedbackType: FeedbackType
  contextType: FeedbackContextType
  contextId?: string
  rating?: number
  tags?: string[]
  message?: string
  locale?: string
  appVersion?: string
  os?: string
  deviceModel?: string
}

export type FeedbackCreateInput = {
  feedbackType: FeedbackType
  contextType: FeedbackContextType
  contextId?: string
  rating?: number
  tags?: string[]
  message?: string
  includeDeviceInfo?: boolean
}
