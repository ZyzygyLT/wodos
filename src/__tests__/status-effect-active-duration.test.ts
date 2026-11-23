import { describe, expect, it } from 'vitest'
import {
  calculateLegacyStatusDamage,
  isLegacyCombatUnitDisabled,
  type LegacyCombatStatusEffect,
} from '@/engine/adapters/combat/status-effect-adapter'

const status = (overrides: Partial<LegacyCombatStatusEffect> = {}): LegacyCombatStatusEffect => ({
  type: 'poison',
  remainingRounds: 1,
  value: 5,
  source: 'source-1',
  sourceName: 'Alchemist',
  ...overrides,
})

describe('legacy combat status active duration', () => {
  it('does not apply periodic damage from an expired status', () => {
    expect(calculateLegacyStatusDamage([
      status({ remainingRounds: 0, value: 9 }),
      status({ type: 'burn', remainingRounds: 2, value: 4 }),
    ])).toBe(4)
  })

  it('does not skip a turn for an expired stun or freeze', () => {
    expect(isLegacyCombatUnitDisabled([
      status({ type: 'stun', remainingRounds: 0 }),
      status({ type: 'freeze', remainingRounds: 0 }),
    ])).toBe(false)
  })

  it('still resolves active incapacitating statuses', () => {
    expect(isLegacyCombatUnitDisabled([
      status({ type: 'stun', remainingRounds: 1 }),
    ])).toBe(true)
  })
})
