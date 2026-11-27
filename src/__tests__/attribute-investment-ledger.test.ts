import { describe, expect, it } from "vitest"
import {
  appendAttributeInvestments,
  refundAttributeInvestments,
} from "@/lib/attribute-investment-ledger"

describe("attribute investment ledger", () => {
  it("records free points and exact EP costs in allocation order", () => {
    const ledger = appendAttributeInvestments({}, "st", 2, [10, 15])
    expect(ledger).toEqual({
      st: [
        { source: "free" },
        { source: "free" },
        { source: "ep", cost: 10 },
        { source: "ep", cost: 15 },
      ],
    })
  })

  it("refunds the latest investments using their original sources", () => {
    const ledger = {
      st: [
        { source: "free" as const },
        { source: "ep" as const, cost: 10 },
        { source: "ep" as const, cost: 15 },
      ],
    }
    const result = refundAttributeInvestments(ledger, "st", 2)
    expect(result).toEqual({
      ledger: { st: [{ source: "free" }] },
      freeRefund: 0,
      epRefund: 25,
    })
  })

  it("restores free points without issuing an EP refund", () => {
    const result = refundAttributeInvestments(
      { pe: [{ source: "free" }] },
      "pe",
      1,
    )
    expect(result).toEqual({
      ledger: {},
      freeRefund: 1,
      epRefund: 0,
    })
  })

  it("does not guess the provenance of pre-existing attribute points", () => {
    expect(refundAttributeInvestments({}, "st", 1)).toBeNull()
  })

  it("rejects refunds larger than the tracked investment history", () => {
    expect(
      refundAttributeInvestments(
        { st: [{ source: "ep", cost: 10 }] },
        "st",
        2,
      ),
    ).toBeNull()
  })

  it("rejects malformed ledgers rather than granting a guessed refund", () => {
    expect(
      refundAttributeInvestments({ st: [{ source: "ep", cost: -5 }] }, "st", 1),
    ).toBeNull()
  })
})
