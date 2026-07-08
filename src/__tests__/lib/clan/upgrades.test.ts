import { describe, it, expect } from 'vitest'

const { calcClanBonuses, CLAN_UPGRADES } = await import('@/lib/clan/upgrades')

describe('calcClanBonuses', () => {
  it('returns empty object for empty upgrades', () => {
    expect(calcClanBonuses([])).toEqual({})
  })

  it('aggregates single upgrade bonus', () => {
    const result = calcClanBonuses([{ upgradeId: 'library', tier: 1 }])
    expect(result).toEqual({ ep_bonus_pct: 5 })
  })

  it('stacks same bonus from multiple tiers', () => {
    const result = calcClanBonuses([
      { upgradeId: 'library', tier: 1 },
      { upgradeId: 'library', tier: 2 },
    ])
    expect(result).toEqual({ ep_bonus_pct: 15 })
  })

  it('combines different upgrade bonuses', () => {
    const result = calcClanBonuses([
      { upgradeId: 'library', tier: 1 },
      { upgradeId: 'training', tier: 2 },
    ])
    expect(result).toEqual({ ep_bonus_pct: 5, atk_bonus_pct: 10, def_bonus_pct: 10 })
  })

  it('ignores unknown upgrade IDs', () => {
    const result = calcClanBonuses([{ upgradeId: 'nonexistent' as any, tier: 1 }])
    expect(result).toEqual({})
  })

  it('ignores unknown tier', () => {
    const result = calcClanBonuses([{ upgradeId: 'library', tier: 99 }])
    expect(result).toEqual({})
  })

  it('handles all upgrades simultaneously', () => {
    const allUpgrades = Object.keys(CLAN_UPGRADES).map(id => ({
      upgradeId: id,
      tier: 1,
    }))
    const result = calcClanBonuses(allUpgrades)
    expect(Object.keys(result).length).toBeGreaterThan(0)
    expect(result.ep_bonus_pct).toBe(5)
    expect(result.timer_reduction_hours).toBe(1)
    expect(result.atk_bonus_pct).toBe(5)
  })
})
