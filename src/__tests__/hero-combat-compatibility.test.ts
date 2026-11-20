import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeDefenseForHero, computeDefenseFromFormula } from '@/lib/combat-engine/hero-stats'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('hero combat compatibility baseline', () => {
  it('keeps the formula-only helper deterministic and rounded', () => {
    expect(
      computeDefenseFromFormula(
        {
          attrCoeffs: { st: 1.25, dx: 0.5 },
          skillRankCoeff: 1.5,
          diceSides: 0,
          diceCount: 0,
          flatBonus: 0.25,
        },
        { st: 4, dx: 3 },
        2
      )
    ).toBe(10)
  })

  it('uses equipped classic-attribute bonuses, selected defense skills and the legacy fallback', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)

    const result = computeDefenseForHero({
      attrs: { st: 3, dx: 4, co: 2 },
      items: [
        {
          equipped: true,
          item: { stats: { st: 2, dx: 1, healHp: 50, arcanePower: 9 } },
        },
        {
          equipped: false,
          item: { stats: { st: 100, dx: 100 } },
        },
      ],
      combatProfiles: [
        {
          dungeonLevel: 5,
          defenseSkills: { melee: 99, ranged: null, magic: null },
        },
        {
          dungeonLevel: null,
          defenseSkills: { melee: 7, ranged: null, magic: null },
        },
      ],
      skills: [
        {
          skillId: 7,
          rank: 2,
          skill: {
            id: 7,
            formula: {
              attrCoeffs: { st: 1 },
              skillRankCoeff: 2,
              diceSides: 6,
              diceCount: 1,
              flatBonus: 1,
            },
          },
        },
      ],
    })

    // Melee: (base STR 3 + equipped STR 2) + rank term 4 + flat 1 + die 1.
    expect(result.values.melee).toBe(11)
    // Ranged/magic without a configured skill retain the legacy DX * 2 fallback.
    expect(result.values.ranged).toBe(10)
    expect(result.values.magic).toBe(10)
    expect(result.breakdown.melee).toContain('st=3+2(eq) × 1 = 5')
  })

  it('does not allow an absent formula to produce formula-based defense', () => {
    expect(
      computeDefenseFromFormula(undefined, { st: 10 }, 3)
    ).toBe(0)
  })
})
