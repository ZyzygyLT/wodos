import { describe, expect, it } from 'vitest'
import {
  advanceLegacyCombatBuffs,
  applyLegacyCombatBuff,
  calculateLegacyGroupBuffBonuses,
  gameEffectToLegacyBuff,
  legacyBuffToGameEffect,
  legacyBuffToStatModifier,
} from '@/engine/adapters/combat/buff-effect-adapter'

const buff = (
  type: 'atk' | 'def',
  value: number,
  remainingRounds: number | null,
  sourceName = 'Battle cry',
  side: 'hero' | 'enemy' = 'hero',
) => ({ type, value, remainingRounds, sourceName, side })

describe('legacy combat buff adapter', () => {
  it('round-trips finite and permanent buffs through GameEffect', () => {
    const finite = { ...buff('atk', 15, 3), icon: '⚔️' }
    expect(gameEffectToLegacyBuff(legacyBuffToGameEffect(finite))).toEqual(finite)
    const permanent = buff('def', 10, null, 'Fortress', 'enemy')
    expect(gameEffectToLegacyBuff(legacyBuffToGameEffect(permanent))).toEqual(permanent)
  })

  it('attaches a typed percentage stat modifier to each active buff effect', () => {
    const attack = buff('atk', 15, 2, 'Battle cry', 'hero')
    const defense = buff('def', 20, null, 'Fortress', 'enemy')

    expect(legacyBuffToGameEffect(attack).modifiers).toEqual([
      legacyBuffToStatModifier(attack),
    ])
    expect(legacyBuffToGameEffect(defense).modifiers).toEqual([
      legacyBuffToStatModifier(defense),
    ])
    expect(legacyBuffToStatModifier(attack)).toMatchObject({
      stat: 'attack',
      operation: 'percent',
      value: 15,
      source: 'legacy-group-buffs',
    })
    expect(legacyBuffToStatModifier(defense)).toMatchObject({
      stat: 'defense',
      operation: 'percent',
      value: 20,
    })
  })

  it('keeps source, type and side as independent buff identities', () => {
    const initial = buff('atk', 10, 2)
    const result = applyLegacyCombatBuff([initial], buff('def', 12, 2))
    expect(result).toEqual([initial, buff('def', 12, 2)])
    expect(applyLegacyCombatBuff(result, buff('atk', 10, 2, 'Battle cry', 'enemy'))).toHaveLength(3)
    expect(applyLegacyCombatBuff(result, buff('atk', 10, 2, 'Different source'))).toHaveLength(3)
  })

  it('preserves legacy stronger-value and longer-duration refresh semantics', () => {
    const initial = buff('atk', 15, 2)
    expect(applyLegacyCombatBuff([initial], buff('atk', 10, 4))).toEqual([
      { ...initial, remainingRounds: 4 },
    ])
    expect(applyLegacyCombatBuff([initial], buff('atk', 20, 1))).toEqual([
      { ...initial, value: 20, remainingRounds: 1 },
    ])
  })

  it('preserves the legacy permanent-to-finite refresh edge case', () => {
    const permanent = buff('def', 10, null)
    expect(applyLegacyCombatBuff([permanent], buff('def', 8, 2))).toEqual([
      { ...permanent, remainingRounds: 2 },
    ])
  })

  it('ticks finite buffs and retains permanent buffs', () => {
    expect(advanceLegacyCombatBuffs([
      buff('atk', 10, 1), buff('def', 20, 3), buff('atk', 5, null),
    ])).toEqual([
      buff('def', 20, 2), buff('atk', 5, null),
    ])
  })

  it('ticks duplicate legacy entries without colliding on engine effect IDs', () => {
    const duplicate = buff('atk', 10, 2)
    expect(advanceLegacyCombatBuffs([duplicate, duplicate])).toEqual([
      buff('atk', 10, 1), buff('atk', 10, 1),
    ])
  })

  it('uses the strongest active bonus rather than adding group buffs', () => {
    expect(calculateLegacyGroupBuffBonuses([
      buff('atk', 10, 2), buff('atk', 25, 1, 'Rally'),
      buff('def', 8, null), buff('def', 30, 0, 'Expired'),
    ])).toEqual({ atk: 25, def: 8 })
  })

  it('resolves group bonuses independently for heroes and enemies', () => {
    const buffs = [
      buff('atk', 25, 2, 'Hero rally', 'hero'),
      buff('atk', 40, 2, 'Enemy frenzy', 'enemy'),
      buff('def', 12, 2, 'Hero guard', 'hero'),
      buff('def', 30, 0, 'Expired enemy guard', 'enemy'),
    ]

    expect(calculateLegacyGroupBuffBonuses(buffs, 'hero')).toEqual({ atk: 25, def: 12 })
    expect(calculateLegacyGroupBuffBonuses(buffs, 'enemy')).toEqual({ atk: 40, def: 0 })
    // Omitting side preserves the aggregate reporting/legacy API.
    expect(calculateLegacyGroupBuffBonuses(buffs)).toEqual({ atk: 40, def: 12 })
  })

  it('rejects invalid incoming buff data', () => {
    expect(() => legacyBuffToGameEffect(buff('atk', Number.NaN, 2))).toThrow(RangeError)
    expect(() => legacyBuffToGameEffect(buff('def', 2, -1))).toThrow(RangeError)
    expect(() => legacyBuffToGameEffect(buff('atk', 2, 1, ' '))).toThrow()
  })
})
