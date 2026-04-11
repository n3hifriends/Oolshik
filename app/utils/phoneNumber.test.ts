import {
  getDigitsOnly,
  isLikelyIndianMobileNumber,
  normalizeIndianPhoneNumber,
  toIndianE164,
  toIndianNationalNumber,
} from "./phoneNumber"

describe("phoneNumber utils", () => {
  test("strips non-digit characters", () => {
    expect(getDigitsOnly("+91 98765 43210")).toBe("919876543210")
  })

  test("normalizes common Indian mobile formats", () => {
    expect(toIndianNationalNumber("9876543210")).toBe("9876543210")
    expect(toIndianNationalNumber("09876543210")).toBe("9876543210")
    expect(toIndianNationalNumber("+91 98765 43210")).toBe("9876543210")
    expect(toIndianNationalNumber("0919876543210")).toBe("9876543210")
    expect(toIndianNationalNumber("00919876543210")).toBe("9876543210")
    expect(toIndianNationalNumber("919534343456")).toBe("9534343456")
    expect(toIndianNationalNumber("91953434345699")).toBe("9534343456")
    expect(toIndianNationalNumber("091953434345699")).toBe("9534343456")
    expect(toIndianNationalNumber("123919534343456")).toBe("9534343456")
    expect(normalizeIndianPhoneNumber("91953434345699")).toEqual({
      nationalNumber: "9534343456",
      e164: "+919534343456",
    })
  })

  test("builds E.164 output for valid Indian mobile numbers", () => {
    expect(toIndianE164("9876543210")).toBe("+919876543210")
    expect(normalizeIndianPhoneNumber("+91 98765 43210")).toEqual({
      nationalNumber: "9876543210",
      e164: "+919876543210",
    })
  })

  test("accepts the repo's current 10-digit validation rule", () => {
    expect(isLikelyIndianMobileNumber("1234567890")).toBe(true)
  })

  test("rejects malformed numbers", () => {
    expect(normalizeIndianPhoneNumber("12345")).toEqual({
      nationalNumber: null,
      e164: null,
    })
    expect(normalizeIndianPhoneNumber("+1 415 555 2671")).toEqual({
      nationalNumber: null,
      e164: null,
    })
  })
})
