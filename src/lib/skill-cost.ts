export function skillUpgradeCost(baseCost: number, currentRank: number): number {
  if (baseCost <= 0) {
    return Math.max(1, currentRank)
  }
  return Math.ceil(baseCost * Math.pow(1.5, currentRank - 1))
}
