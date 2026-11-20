import { describe, expect, it } from 'vitest'
import {
  calculateDerivedCombatStats,
  calculateMaxHp,
  calculateMaxMp,
  calculateDefenseBase,
  calculateInitiativeBase,
  calculateDefense,
  createSeededRandom,
} from '@/engine/core'

describe('Wodos derived-stat profile', () => {
  it('calculates HP, MP, base defense and initiative using the established formulas', () => {
    const attrs = { co: 8, wi: 12, in: 5, ag: 9, pe: 7 }
    expect(calculateMaxHp(attrs, 4)).toBe(100)
    expect(calculateMaxMp(attrs)).toBe(116)
    expect(calculateDefenseBase(attrs)).toBe(25)
    expect(calculateInitiativeBase(attrs)).toBe(12)
    expect(calculateDerivedCombatStats(attrs, 4)).toEqual({
      hpMax: 100, mpMax: 116, defenseBase: 25, initiativeBase: 12,
    })
  })
})

describe('engine defense calculation', () => {
  it('uses configured defense skill formula, rank and injected dice', () => {
    const result = calculateDefense({
      attributes: { st: 5, dx: 4 },
      baseAttributes: { st: 3, dx: 4 },
      profile: { defenseSkills: { melee: 7, ranged: null, magic: null } },
      skills: [{
        skillId: 7, rank: 2,
        skill: { formula: { attrCoeffs: { st: 1 }, skillRankCoeff: 2, diceCount: 1, diceSides: 6, flatBonus: 1 } },
      }],
      random: { next: () => 0 },
    })
    expect(result.values).toEqual({ melee: 11, ranged: 8, magic: 8 })
    expect(result.breakdown.melee).toContain('st=3+2(eq) × 1 = 5')
  })

  it('supports reproducible seeded defense rolls', () => {
    const input = {
      attributes: { dx: 4 },
      profile: { defenseSkills: { melee: 1 } },
      skills: [{ skillId: 1, rank: 1, formula: { attrCoeffs: {}, diceCount: 1, diceSides: 6, flatBonus: 0 } }],
    }
    expect(calculateDefense({ ...input, random: createSeededRandom(42) }))
      .toEqual(calculateDefense({ ...input, random: createSeededRandom(42) }))
  })
})
