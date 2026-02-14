export type AuthUser = {
  id?: string
  displayName?: string
  email?: string
  phoneNumber?: string
  avatarUri?: string
  isPhoneVerified?: boolean
  isEmailVerified?: boolean
}

export type ProfileExtras = {
  fullNameOverride?: string
  nickname?: string
  locality?: string
  language?: "mr" | "en" | "mr-IN" | "en-IN" | string
  preferredLanguage?: "mr-IN" | "en-IN" | string
  notificationsEnabled?: boolean
  helperRadiusKm?: number
  helperAvailable?: boolean
}

export type DerivedProfileViewModel = {
  nameToShow: string
  identifier: string
  initials: string
  verificationLabel?: string
}
