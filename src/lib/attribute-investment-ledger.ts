export type AttributeInvestment =
  | { source: "free" }
  | { source: "ep"; cost: number }

export type AttributeInvestmentLedger = Record<string, AttributeInvestment[]>

function isInvestment(value: unknown): value is AttributeInvestment {
  if (!value || typeof value !== "object") return false
  const entry = value as Record<string, unknown>
  if (entry.source === "free") return true
  return entry.source === "ep" && Number.isInteger(entry.cost) && (entry.cost as number) > 0
}

function readLedger(value: unknown): AttributeInvestmentLedger | null {
  if (value == null) return {}
  if (typeof value !== "object" || Array.isArray(value)) return null

  const ledger: AttributeInvestmentLedger = {}
  for (const [attr, entries] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(entries) || !entries.every(isInvestment)) return null
    ledger[attr] = entries.map(entry => ({ ...entry }))
  }
  return ledger
}

export function appendAttributeInvestments(
  value: unknown,
  attr: string,
  freePoints: number,
  epCosts: number[],
): AttributeInvestmentLedger | null {
  const ledger = readLedger(value)
  if (!ledger || !Number.isInteger(freePoints) || freePoints < 0) return null
  if (!epCosts.every(cost => Number.isInteger(cost) && cost > 0)) return null

  const existing = ledger[attr] ?? []
  ledger[attr] = [
    ...existing,
    ...Array.from({ length: freePoints }, () => ({ source: "free" as const })),
    ...epCosts.map(cost => ({ source: "ep" as const, cost })),
  ]
  return ledger
}

export function refundAttributeInvestments(
  value: unknown,
  attr: string,
  points: number,
): { ledger: AttributeInvestmentLedger; freeRefund: number; epRefund: number } | null {
  const ledger = readLedger(value)
  if (!ledger || !Number.isInteger(points) || points < 1) return null

  const entries = ledger[attr] ?? []
  // Existing attribute values predate provenance tracking. Never guess their source.
  if (entries.length < points) return null

  const kept = entries.slice(0, -points)
  const refunded = entries.slice(-points)
  const freeRefund = refunded.filter(entry => entry.source === "free").length
  const epRefund = refunded.reduce(
    (total, entry) => total + (entry.source === "ep" ? entry.cost : 0),
    0,
  )

  if (kept.length > 0) ledger[attr] = kept
  else delete ledger[attr]

  return { ledger, freeRefund, epRefund }
}
