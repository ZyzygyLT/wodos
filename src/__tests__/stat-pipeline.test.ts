import { describe, expect, it } from 'vitest'
import { asEntityId } from '@/engine/core/entities/entity'
import { calculateStats } from '@/engine/core/stats/stat-pipeline'
import type { GameEffect } from '@/engine/core/effects/effect'
import type { StatModifier } from '@/engine/core/stats/stat-modifier'

const heroId = asEntityId('hero-1')
const otherId = asEntityId('hero-2')

describe('stat pipeline', () => {
  it('combines base stats, equipment modifiers and active effect modifiers', () => {
    const equipment: StatModifier[] = [
      { id: 'sword:attack', stat: 'attack', operation: 'flat', value: 5, source: 'item:sword' },
    ]
    const effects: GameEffect[] = [
      {
        id: 'blessing-1', kind: 'blessing', targetId: heroId,
        duration: { type: 'rounds', remaining: 2 }, stacking: 'refresh',
        modifiers: [{ id: 'blessing:attack', stat: 'attack', operation: 'percent', value: 10 }],
      },
    ]
    const result = calculateStats({ entityId: heroId, baseStats: { attack: 20, defense: 4 }, modifiers: equipment, effects })
    expect(result.values).toEqual({ attack: 27.5, defense: 4 })
    expect(result.breakdown.attack.flatModifiers).toHaveLength(1)
    expect(result.breakdown.attack.percentModifiers[0].source).toBe('effect:blessing-1')
    expect(result.activeEffectIds).toEqual(['blessing-1'])
  })

  it('ignores expired effects and effects targeting another entity', () => {
    const effects: GameEffect[] = [
      {
        id: 'expired', kind: 'poison', targetId: heroId,
        duration: { type: 'turns', remaining: 0 }, stacking: 'stack',
        modifiers: [{ id: 'poison:health', stat: 'health', operation: 'flat', value: -10 }],
      },
      {
        id: 'other-hero', kind: 'aura', targetId: otherId,
        duration: { type: 'permanent' }, stacking: 'stack',
        modifiers: [{ id: 'aura:health', stat: 'health', operation: 'flat', value: 50 }],
      },
    ]
    const result = calculateStats({ entityId: heroId, baseStats: { health: 100 }, effects })
    expect(result.values.health).toBe(100)
    expect(result.activeEffectIds).toEqual([])
    expect(result.ignoredExpiredEffectIds).toEqual(['expired'])
  })

  it('creates a stat from modifiers even when no base stat was supplied', () => {
    const result = calculateStats({
      entityId: heroId, baseStats: {},
      modifiers: [{ id: 'temporary-speed', stat: 'speed', operation: 'flat', value: 3 }],
    })
    expect(result.values.speed).toBe(3)
  })

  it('rejects non-finite base values and modifiers', () => {
    expect(() => calculateStats({ entityId: heroId, baseStats: { hp: Number.NaN } })).toThrow(RangeError)
    expect(() => calculateStats({
      entityId: heroId, baseStats: { hp: 10 },
      modifiers: [{ id: 'bad', stat: 'hp', operation: 'flat', value: Number.POSITIVE_INFINITY }],
    })).toThrow(RangeError)
  })
})
