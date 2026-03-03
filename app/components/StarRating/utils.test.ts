import { clampRating, getRatingDescriptorKey, normalizeRating } from "./utils"

describe("StarRating utils", () => {
  test("clampRating keeps value in range", () => {
    expect(clampRating(-2, 0, 5)).toBe(0)
    expect(clampRating(7, 0, 5)).toBe(5)
    expect(clampRating(2.5, 0, 5)).toBe(2.5)
  })

  test("normalizeRating snaps to nearest 0.5", () => {
    expect(normalizeRating(4.74, { min: 0, max: 5, step: 0.5 })).toBe(4.5)
    expect(normalizeRating(4.76, { min: 0, max: 5, step: 0.5 })).toBe(5)
    expect(normalizeRating(-1, { min: 0, max: 5, step: 0.5 })).toBe(0)
  })

  test("normalizeRating supports one decimal payload", () => {
    expect(normalizeRating(3.14, { min: 0, max: 5, step: 0.5 })).toBe(3)
    expect(normalizeRating(3.26, { min: 0, max: 5, step: 0.5 })).toBe(3.5)
  })

  test("descriptor buckets", () => {
    expect(getRatingDescriptorKey(1)).toBe("poor")
    expect(getRatingDescriptorKey(2.5)).toBe("okay")
    expect(getRatingDescriptorKey(4)).toBe("good")
    expect(getRatingDescriptorKey(5)).toBe("excellent")
  })
})
