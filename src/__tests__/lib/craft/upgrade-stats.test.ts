import { describe, it, expect } from 'vitest'

const { applyUpgradeStats } = await import('@/lib/craft/upgrade-stats')

describe('applyUpgradeStats', () => {
  it('returns same stats when upgradeLevel <= 0', () => {
    const stats = { atk: 10, def: 5 }
    expect(applyUpgradeStats(stats, 0)).toEqual(stats)
    expect(applyUpgradeStats(stats, -1)).toEqual(stats)
  })

  it('multiplies stats by 1 + level * 0.2', () => {
    const stats = { atk: 100, def: 50 }
    const result = applyUpgradeStats(stats, 1)
    expect(result.atk).toBe(120)
    expect(result.def).toBe(60)
  })

  it('rounds to integer', () => {
    const stats = { atk: 33 }
    const result = applyUpgradeStats(stats, 2)
    expect(result.atk).toBe(46)  // 33 * 1.4 = 46.2 -> 46
  })

  it('scales with upgrade level', () => {
    const stats = { atk: 100 }
    expect(applyUpgradeStats(stats, 3).atk).toBe(160)
    expect(applyUpgradeStats(stats, 5).atk).toBe(200)
  })

  it('does not mutate original stats object', () => {
    const stats = { atk: 100 }
    const result = applyUpgradeStats(stats, 1)
    expect(stats.atk).toBe(100)
    expect(result.atk).toBe(120)
  })
})
