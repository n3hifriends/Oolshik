import { isValidUpiId, maskUpiId, normalizeUpiId } from "@/utils/paymentProfile"

describe("paymentProfile utils", () => {
  it("normalizes UPI IDs", () => {
    expect(normalizeUpiId("  Nitin.Pay@YBL ")).toBe("nitin.pay@ybl")
  })

  it("validates conservative UPI ID patterns", () => {
    expect(isValidUpiId("nitin.pay@ybl")).toBe(true)
    expect(isValidUpiId("bad upi id")).toBe(false)
  })

  it("masks UPI IDs for display", () => {
    expect(maskUpiId("nitin.pay@ybl")).toBe("ni******y@ybl")
  })
})
