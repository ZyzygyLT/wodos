const STAT_PER_LEVEL = 0.2

export function applyUpgradeStats(stats: Record<string, number>, upgradeLevel: number): Record<string, number> {
  if (upgradeLevel <= 0) return { ...stats }
  const multiplier = 1 + upgradeLevel * STAT_PER_LEVEL
  const result: Record<string, number> = {}
  for (const [k, v] of Object.entries(stats)) {
    result[k] = Math.round(v * multiplier)
  }
  return result
}
