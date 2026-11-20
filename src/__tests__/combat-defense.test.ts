import { describe, expect, it } from 'vitest'
import { calculateDefense } from '@/engine/core/combat/defense'

describe('calculateDefense', () => {
  it('uses the neutral dice baseline instead of adding raw dice totals', () => {
    const result = calculateDefense({
      attributes: { st: 10, dx: 8 },
      profile: { defenseSkills: { melee: 7 } },
      skills: [{
        skillId: 7,
        rank: 2,
        formula: {
          attrCoeffs: { st: 2 },
          skillRankCoeff: 1.5,
          diceCount: 2,
          diceSides: 6,
          flatBonus: 5,
        },
      }],
    })

    // 10 * 2 + 2 * 1.5 + 5 = 28; combat rolls apply centered dice multipliers later.
    expect(result.values.melee).toBe(28)
    expect(result.breakdown.melee).toContain('rango × 1.5 = 3')
  })

  it('keeps the DX fallback when no defense skill is selected', () => {
    const result = calculateDefense({
      attributes: { dx: 12 },
      profile: { defenseSkills: {} },
    })

    expect(result.values.melee).toBe(24)
    expect(result.values.ranged).toBe(24)
    expect(result.values.magic).toBe(24)
  })

  it('clamps a negative formula baseline to the minimum defense', () => {
    const result = calculateDefense({
      attributes: { st: 1 },
      profile: { defenseSkills: { melee: 7 } },
      skills: [{
        skillId: 7,
        rank: 1,
        formula: {
          attrCoeffs: { st: -100 },
          skillRankCoeff: 0,
          diceCount: 0,
          diceSides: 0,
          flatBonus: 0,
        },
      }],
    })

    expect(result.values.melee).toBe(1)
  })
})
