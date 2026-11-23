import { describe, expect, it } from 'vitest'
import {
  applyLegacyStatusEffect,
  advanceLegacyStatusRound,
  type LegacyCombatStatusEffect,
} from '@/engine/adapters/combat/status-effect-adapter'
import {
  applyLegacyCombatBuff,
  advanceLegacyCombatBuffs,
  type LegacyCombatBuff,
} from '@/engine/adapters/combat/buff-effect-adapter'

const status = (
  type: LegacyCombatStatusEffect['type'],
  remainingRounds: number,
  value: number,
  source = 'Hero',
): LegacyCombatStatusEffect => ({ type, remainingRounds, value, source, sourceName: source })

const buff = (
  type: LegacyCombatBuff['type'],
  value: number,
  remainingRounds: number | null,
  sourceName = 'Battle cry',
  side: LegacyCombatBuff['side'] = 'hero',
): LegacyCombatBuff => ({ type, value, remainingRounds, sourceName, side })

describe('legacy effect application through the shared lifecycle', () => {
  it('refreshes one status type while preserving legacy max value, duration and source', () => {
    expect(applyLegacyStatusEffect(
      [status('poison', 2, 8, 'Original source'), status('burn', 1, 4)],
      status('poison', 5, 3, 'New source'),
    )).toEqual([
      status('poison', 5, 8, 'Original source'),
      status('burn', 1, 4),
    ])
  })

  it('adds a new status type without replacing unrelated statuses', () => {
    expect(applyLegacyStatusEffect(
      [status('poison', 2, 8)],
      status('stun', 1, 0),
    )).toEqual([status('poison', 2, 8), status('stun', 1, 0)])
  })

  it('advances status durations and removes expired statuses', () => {
    expect(advanceLegacyStatusRound([
      status('poison', 1, 5),
      status('burn', 3, 2),
    ])).toEqual([status('burn', 2, 2)])
  })

  it('applies buffs using source/type/side identity and keeps legacy stronger-value rules', () => {
    expect(applyLegacyCombatBuff(
      [buff('atk', 15, 2), buff('def', 5, 3, 'Guard', 'enemy')],
      buff('atk', 10, 4),
    )).toEqual([
      buff('atk', 15, 4),
      buff('def', 5, 3, 'Guard', 'enemy'),
    ])
  })

  it('preserves the legacy permanent-to-finite buff refresh rule', () => {
    expect(applyLegacyCombatBuff(
      [buff('def', 10, null)],
      buff('def', 8, 2),
    )).toEqual([buff('def', 10, 2)])
  })

  it('advances finite buffs but leaves permanent buffs active', () => {
    expect(advanceLegacyCombatBuffs([
      buff('atk', 10, 1),
      buff('def', 20, null),
    ])).toEqual([buff('def', 20, null)])
  })
})
