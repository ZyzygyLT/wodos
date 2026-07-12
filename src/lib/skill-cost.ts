export function skillUpgradeCost(baseCost: number, currentRank: number): number {
  return Math.ceil(baseCost * Math.pow(1.5, currentRank - 1))
}
