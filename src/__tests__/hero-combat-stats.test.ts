import { describe, expect, it } from 'vitest'
import { computeDefenseForHero, computeResistancesForHero } from '@/lib/combat-engine/hero-stats'

describe('hero combat profile stats', () => {
  it('includes equipment defense and fortitude in all displayed defense categories', () => {
    const result = computeDefenseForHero({
      id: 'hero-1',
      attrs: { dx: 10, ag: 8, pe: 6 },
      equipStats: { dx: 2, def: 15 },
      combatProfiles: [{ dungeonLevel: null, defenseSkills: {} }],
      skills: [{ skillId: 99, effect: 'fortitude', rank: 1 }],
    })

    expect(result.values).toEqual({
      melee: 49,
      ranged: 49,
      magic: 49,
    })
    expect(result.breakdown.melee).toContain('bono fijo de equipo/pasiva = +25')
  })

  it('resolves armor and elemental resistances in the same channels as combat', () => {
    expect(computeResistancesForHero({
      equipStats: {
        armor: 12,
        fireResist: 25,
        iceResist: 10,
        poisonResist: Number.NaN,
      },
    })).toEqual({
      physical: 12,
      piercing: 12,
      bleed: 12,
      fire: 25,
      ice: 10,
    })
  })
})
