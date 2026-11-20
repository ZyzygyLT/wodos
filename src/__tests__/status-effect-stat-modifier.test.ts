import { describe, expect, it } from 'vitest'
import {
  legacyStatusToGameEffect,
  legacyStatusToStatModifiers,
  type LegacyCombatStatusEffect,
} from '@/engine/adapters/combat/status-effect-adapter'

const status = (type: LegacyCombatStatusEffect['type'], value: number): LegacyCombatStatusEffect => ({
  type,
  value,
  remainingRounds: 2,
  source: 'skill',
  sourceName: 'Battle stance',
})

describe('legacy status stat modifier mapping', () => {
  it('maps attack and defense statuses to percentage stat modifiers', () => {
    expect(legacyStatusToStatModifiers(status('atk_up', 15))).toMatchObject([
      { stat: 'attack', operation: 'percent', value: 15, source: 'legacy-status' },
    ])
    expect(legacyStatusToStatModifiers(status('def_up', 20))).toMatchObject([
      { stat: 'defense', operation: 'percent', value: 20, source: 'legacy-status' },
    ])
  })

  it.each(['poison', 'burn', 'bleed', 'stun', 'freeze', 'shield', 'regen'] as const)(
    'does not reinterpret %s as a stat modifier',
    type => {
      expect(legacyStatusToStatModifiers(status(type, 12))).toEqual([])
      expect(legacyStatusToGameEffect('unit-1', status(type, 12)).modifiers).toEqual([])
    },
  )

  it('stores mapped modifiers on the engine effect without changing status metadata or duration', () => {
    const incoming = status('atk_up', 15)
    const effect = legacyStatusToGameEffect('unit-1', incoming)
    expect(effect.duration).toEqual({ type: 'rounds', remaining: 2 })
    expect(effect.metadata).toMatchObject({
      legacyType: 'atk_up',
      value: 15,
      source: 'skill',
      sourceName: 'Battle stance',
    })
    expect(effect.modifiers).toEqual(legacyStatusToStatModifiers(incoming))
  })
})
