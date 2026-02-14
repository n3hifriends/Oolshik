import {
  fromLanguageCode,
  normalizeLocaleTag,
  pickDeviceLocaleTag,
  resolvePreferredLocale,
  toLanguageCode,
} from "../app/i18n/locale"

describe("locale resolution", () => {
  test("normalizes locale tags", () => {
    expect(normalizeLocaleTag("mr")).toBe("mr-IN")
    expect(normalizeLocaleTag("mr_IN")).toBe("mr-IN")
    expect(normalizeLocaleTag("en-US")).toBe("en-IN")
    expect(normalizeLocaleTag("de-DE")).toBe("en-IN")
  })

  test("resolves priority as server > local > device > fallback", () => {
    expect(
      resolvePreferredLocale({
        serverPreference: "mr",
        localPreference: "en-IN",
        deviceLocaleTag: "en-US",
      }),
    ).toBe("mr-IN")
    expect(
      resolvePreferredLocale({
        localPreference: "mr-IN",
        deviceLocaleTag: "en-US",
      }),
    ).toBe("mr-IN")
    expect(resolvePreferredLocale({ deviceLocaleTag: "mr-IN" })).toBe("mr-IN")
    expect(resolvePreferredLocale({})).toBe("en-IN")
  })

  test("picks supported device locale only for en/mr", () => {
    expect(
      pickDeviceLocaleTag([
        { languageTag: "fr-FR", textDirection: "ltr" } as any,
        { languageTag: "mr-IN", textDirection: "ltr" } as any,
      ]),
    ).toBe("mr-IN")
    expect(
      pickDeviceLocaleTag([{ languageTag: "fr-FR", textDirection: "ltr" } as any]),
    ).toBeUndefined()
  })

  test("maps language code helpers", () => {
    expect(fromLanguageCode("mr")).toBe("mr-IN")
    expect(fromLanguageCode("en")).toBe("en-IN")
    expect(toLanguageCode("mr-IN")).toBe("mr")
    expect(toLanguageCode("en-IN")).toBe("en")
  })
})

