import { describe, expect, it } from 'vitest'
import {
  calculateCriticalChance,
  resolveAttackHit,
  resolveCritical,
} from '@/engine/core/combat/attack-resolution'

describe('shared attack resolution', () => {
  it('uses the existing Wodos critical chance and 75% cap', () => {
    expect(calculateCriticalChance(0)).toBe(0.05)
    expect(calculateCriticalChance(20)).toBe(0.15)
    expect(calculateCriticalChance(200)).toBe(0.75)
  })

  it('resolves hit on equality and miss below defense', () => {
    expect(resolveAttackHit({ attackTotal: 10, defenseValue: 10 })).toEqual({ hit: true, margin: 0 })
    expect(resolveAttackHit({ attackTotal: 9, defenseValue: 10 })).toEqual({ hit: false, margin: -1 })
  })

  it('uses an injected random source for critical rolls', () => {
    expect(resolveCritical({ attackerDexterity: 20, random: { next: () => 0.149 } }).critical).toBe(true)
    expect(resolveCritical({ attackerDexterity: 20, random: { next: () => 0.15 } }).critical).toBe(false)
  })

  it('supports guaranteed critical attacks without consuming randomness', () => {
    let consumed = false
    const result = resolveCritical({
      attackerDexterity: 0,
      forced: true,
      random: { next: () => { consumed = true; return 0.99 } },
    })
    expect(result).toMatchObject({ critical: true, chance: 1 })
    expect(consumed).toBe(false)
  })
})
