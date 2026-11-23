import { describe, expect, it } from 'vitest'
import { legacyGroupBuffsToStatModifiers } from '@/engine/adapters/combat/buff-effect-adapter'
import { applyStatModifiers } from '@/engine/core/stats/stat-modifier'

const buff = (
  type: 'atk' | 'def',
  value: number,
  remainingRounds: number | null,
  sourceName = 'Battle cry',
  side: 'hero' | 'enemy' = 'hero',
) => ({ type, value, remainingRounds, sourceName, side })

describe('legacy group buff stat modifier mapping', () => {
  it('maps the strongest active attack and defense buffs to percentage modifiers', () => {
    const modifiers = legacyGroupBuffsToStatModifiers([
      buff('atk', 10, 3),
      buff('atk', 25, 2, 'Rally'),
      buff('def', 15, null),
      buff('def', 8, 3, 'Guard'),
    ])

    expect(modifiers).toEqual([
      {
        id: 'legacy-group-buff:attack',
        stat: 'attack',
        operation: 'percent',
        value: 25,
        source: 'legacy-group-buffs',
      },
      {
        id: 'legacy-group-buff:defense',
        stat: 'defense',
        operation: 'percent',
        value: 15,
        source: 'legacy-group-buffs',
      },
    ])
  })

  it('excludes expired buffs and omits zero-value modifiers', () => {
    expect(legacyGroupBuffsToStatModifiers([
      buff('atk', 50, 0),
      buff('def', 0, null),
    ])).toEqual([])
  })

  it('produces modifiers consumable by the neutral stat pipeline', () => {
    const modifiers = legacyGroupBuffsToStatModifiers([
      buff('atk', 20, 2),
      buff('def', 25, 2),
    ])

    expect(applyStatModifiers(100, modifiers.filter(modifier => modifier.stat === 'attack')))
      .toBe(120)
    expect(applyStatModifiers(100, modifiers.filter(modifier => modifier.stat === 'defense')))
      .toBe(125)
  })

  it('keeps attack and defense as independent stat channels', () => {
    const modifiers = legacyGroupBuffsToStatModifiers([
      buff('atk', 30, 2),
    ])

    expect(modifiers.map(modifier => modifier.stat)).toEqual(['attack'])
  })
})
