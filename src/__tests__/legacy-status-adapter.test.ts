import { describe, expect, it } from 'vitest'
import {
  advanceLegacyStatusRound, advanceLegacyPeriodicStatusRound, advanceLegacyNonPeriodicStatusRound,
  applyLegacyStatusEffect, calculateLegacyStatusDamage,
  gameEffectToLegacyStatus, isLegacyCombatUnitDisabled, legacyStatusToGameEffect,
} from '@/engine/adapters/combat/status-effect-adapter'

const poison = (remainingRounds: number, value: number, source = 'skill-1') => ({
  type: 'poison' as const, remainingRounds, value, source, sourceName: 'Poison skill',
})

describe('legacy combat status adapter', () => {
  it('maps legacy statuses to and from engine effects', () => {
    const legacy = poison(3, 7)
    expect(gameEffectToLegacyStatus(legacyStatusToGameEffect('hero-1', legacy))).toEqual(legacy)
  })

  it('preserves max value and duration while retaining original source on refresh', () => {
    const first = poison(2, 5, 'first')
    expect(applyLegacyStatusEffect([first], poison(4, 3, 'second'))).toEqual([{
      ...first, remainingRounds: 4, value: 5,
    }])
    expect(applyLegacyStatusEffect([first], poison(1, 9))).toEqual([{
      ...first, remainingRounds: 2, value: 9,
    }])
  })

  it('keeps different status types independent', () => {
    const burn = { ...poison(2, 4), type: 'burn' as const }
    expect(applyLegacyStatusEffect([poison(2, 4)], burn)).toHaveLength(2)
  })

  it('calculates round-start damage only for poison, burn and bleed', () => {
    const statuses = [
      poison(2, 5), { ...poison(2, 3), type: 'burn' as const },
      { ...poison(2, 2), type: 'bleed' as const },
      { ...poison(2, 100), type: 'stun' as const },
    ]
    expect(calculateLegacyStatusDamage(statuses)).toBe(10)
  })

  it('recognizes stun and freeze as turn-preventing statuses', () => {
    expect(isLegacyCombatUnitDisabled([poison(1, 0)])).toBe(false)
    expect(isLegacyCombatUnitDisabled([{ ...poison(1, 0), type: 'freeze' }])).toBe(true)
    expect(isLegacyCombatUnitDisabled([{ ...poison(1, 0), type: 'stun' }])).toBe(true)
  })

  it('decays durations at round end and removes expired statuses', () => {
    expect(advanceLegacyStatusRound([poison(1, 5), { ...poison(3, 2), type: 'burn' as const }])).toEqual([{ ...poison(2, 2), type: 'burn' }])
  })

  it('consumes periodic status duration when its round-start tick resolves', () => {
    const statuses = [
      poison(1, 5),
      { ...poison(2, 3), type: 'burn' as const },
      { ...poison(1, 0), type: 'stun' as const },
    ]

    expect(advanceLegacyPeriodicStatusRound(statuses)).toEqual([
      { ...poison(1, 3), type: 'burn' },
      { ...poison(1, 0), type: 'stun' },
    ])
  })

  it('keeps periodic statuses out of the end-of-round duration pass', () => {
    const statuses = [
      poison(2, 5),
      { ...poison(1, 0), type: 'stun' as const },
    ]

    expect(advanceLegacyNonPeriodicStatusRound(statuses)).toEqual([
      poison(2, 5),
    ])
  })

  it('rejects invalid durations and malformed engine metadata', () => {
    expect(() => legacyStatusToGameEffect('hero-1', poison(-1, 2))).toThrow(RangeError)
    const invalid = { ...legacyStatusToGameEffect('hero-1', poison(1, 2)), metadata: {} }
    expect(() => gameEffectToLegacyStatus(invalid)).toThrow('metadata')
  })
})
