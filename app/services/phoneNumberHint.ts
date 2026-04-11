import { NativeModules, Platform } from "react-native"

import { getDigitsOnly, normalizeIndianPhoneNumber } from "@/utils/phoneNumber"

type NativePhoneNumberHintModule = {
  requestPhoneNumberHint(): Promise<string>
}

export type PhoneNumberHintErrorCode =
  | "ACTIVITY_LAUNCH_FAILED"
  | "ALREADY_IN_PROGRESS"
  | "API_ERROR"
  | "DEVELOPER_ERROR"
  | "GET_PHONE_NUMBER_FAILED"
  | "INVALID_PHONE_NUMBER"
  | "NETWORK_ERROR"
  | "NO_ACTIVITY"
  | "UNKNOWN_ERROR"

export type PhoneNumberHintUnsupportedReason =
  | "hint-unavailable-on-device"
  | "native-module-unavailable"
  | "platform-not-android"
  | "play-services-unavailable"

export type PhoneNumberHintResult =
  | {
      status: "success"
      e164PhoneNumber: string
      nationalPhoneNumber: string
      source: "google-phone-number-hint"
    }
  | { status: "cancelled" }
  | {
      status: "unsupported"
      reason: PhoneNumberHintUnsupportedReason
      message: string
    }
  | {
      status: "error"
      code: PhoneNumberHintErrorCode
      message: string
    }

type NativePhoneNumberHintError = {
  code?: string
  message?: string
}

const NativePhoneNumberHint = NativeModules.OolshikPhoneNumberHint as
  | NativePhoneNumberHintModule
  | undefined

function isNativePhoneNumberHintError(error: unknown): error is NativePhoneNumberHintError {
  return typeof error === "object" && error !== null
}

function mapNativeError(error: unknown): Exclude<PhoneNumberHintResult, { status: "success" }> {
  if (!isNativePhoneNumberHintError(error)) {
    return {
      status: "error",
      code: "UNKNOWN_ERROR",
      message: "Phone number hint failed unexpectedly.",
    }
  }

  switch (error.code) {
    case "USER_CANCELLED":
      return { status: "cancelled" }
    case "PLAY_SERVICES_UNAVAILABLE":
      return {
        status: "unsupported",
        reason: "play-services-unavailable",
        message: error.message ?? "Google Play Services is unavailable on this device.",
      }
    case "HINT_UNAVAILABLE":
    case "SIGN_IN_REQUIRED":
      return {
        status: "unsupported",
        reason: "hint-unavailable-on-device",
        message:
          error.message ?? "Phone number hint is unavailable on this device or account right now.",
      }
    case "NO_ACTIVITY":
      return {
        status: "error",
        code: "NO_ACTIVITY",
        message: error.message ?? "No active Android screen is available.",
      }
    case "ACTIVITY_LAUNCH_FAILED":
    case "ALREADY_IN_PROGRESS":
    case "NETWORK_ERROR":
    case "DEVELOPER_ERROR":
    case "GET_PHONE_NUMBER_FAILED":
    case "API_ERROR":
      return {
        status: "error",
        code: error.code,
        message: error.message ?? "Phone number hint failed.",
      }
    default:
      return {
        status: "error",
        code: "UNKNOWN_ERROR",
        message: error.message ?? "Phone number hint failed unexpectedly.",
      }
  }
    }

function buildInvalidPhoneNumberMessage(selectedPhoneNumber: string) {
  if (!__DEV__) {
    return "The selected phone number is not a supported Indian mobile number."
  }

  const digits = getDigitsOnly(selectedPhoneNumber)
  return `Phone hint returned an unsupported format. Raw: "${selectedPhoneNumber}" Digits: "${digits}"`
}

export async function getPhoneNumberHint(): Promise<PhoneNumberHintResult> {
  if (Platform.OS !== "android") {
    return {
      status: "unsupported",
      reason: "platform-not-android",
      message: "Phone number hint is only supported on Android.",
    }
  }

  if (!NativePhoneNumberHint?.requestPhoneNumberHint) {
    return {
      status: "unsupported",
      reason: "native-module-unavailable",
      message: "This build does not include the Android phone number hint native module.",
    }
  }

  try {
    const selectedPhoneNumber = await NativePhoneNumberHint.requestPhoneNumberHint()
    const normalizedPhoneNumber = normalizeIndianPhoneNumber(selectedPhoneNumber)

    if (!normalizedPhoneNumber.e164 || !normalizedPhoneNumber.nationalNumber) {
      return {
        status: "error",
        code: "INVALID_PHONE_NUMBER",
        message: buildInvalidPhoneNumberMessage(selectedPhoneNumber),
      }
    }

    return {
      status: "success",
      e164PhoneNumber: normalizedPhoneNumber.e164,
      nationalPhoneNumber: normalizedPhoneNumber.nationalNumber,
      source: "google-phone-number-hint",
    }
  } catch (error) {
    return mapNativeError(error)
  }
}
