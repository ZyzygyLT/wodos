import { describe, expect, it } from 'vitest'
import {
  calculateEffectiveHealing,
  calculateThornsDamage,
  resolveManaShield,
} from '@/engine/core/combat/effect-resolution'

describe('pure combat effect resolution', () => {
  it('absorbs damage up to available mana without mutating input values', () => {
    expect(resolveManaShield({ enabled: true, currentMp: 12, incomingDamage: 20 }))
      .toEqual({ absorbed: 12, remainingDamage: 8, mpRemaining: 0 })
  })

  it('leaves damage and mana unchanged when shield is disabled or cannot absorb', () => {
    expect(resolveManaShield({ enabled: false, currentMp: 12, incomingDamage: 20 }))
      .toEqual({ absorbed: 0, remainingDamage: 20, mpRemaining: 12 })
    expect(resolveManaShield({ enabled: true, currentMp: 0, incomingDamage: 20 }))
      .toEqual({ absorbed: 0, remainingDamage: 20, mpRemaining: 0 })
    expect(resolveManaShield({ enabled: true, currentMp: 12, incomingDamage: 0 }))
      .toEqual({ absorbed: 0, remainingDamage: 0, mpRemaining: 12 })
  })

  it('normalizes invalid or negative mana and damage before shield absorption', () => {
    expect(resolveManaShield({ enabled: true, currentMp: -5, incomingDamage: 20 }))
      .toEqual({ absorbed: 0, remainingDamage: 20, mpRemaining: 0 })
    expect(resolveManaShield({ enabled: true, currentMp: 12, incomingDamage: -5 }))
      .toEqual({ absorbed: 0, remainingDamage: 0, mpRemaining: 12 })
    expect(resolveManaShield({ enabled: true, currentMp: Number.NaN, incomingDamage: 20 }))
      .toEqual({ absorbed: 0, remainingDamage: 20, mpRemaining: 0 })
    expect(resolveManaShield({ enabled: true, currentMp: 12, incomingDamage: Number.NaN }))
      .toEqual({ absorbed: 0, remainingDamage: 0, mpRemaining: 12 })
  })

  it('calculates reflected damage with legacy rounding and minimum one point', () => {
    expect(calculateThornsDamage({
      enabled: true, incomingDamage: 15, reflectionPercent: 20, attackerAlive: true,
    })).toBe(3)
    expect(calculateThornsDamage({
      enabled: true, incomingDamage: 1, reflectionPercent: 10, attackerAlive: true,
    })).toBe(1)
  })

  it('does not reflect when thorns are disabled, no damage arrives or attacker is defeated', () => {
    expect(calculateThornsDamage({
      enabled: false, incomingDamage: 10, reflectionPercent: 50, attackerAlive: true,
    })).toBe(0)
    expect(calculateThornsDamage({
      enabled: true, incomingDamage: 0, reflectionPercent: 50, attackerAlive: true,
    })).toBe(0)
    expect(calculateThornsDamage({
      enabled: true, incomingDamage: 10, reflectionPercent: 50, attackerAlive: false,
    })).toBe(0)
  })

  it('caps healing at the remaining HP capacity', () => {
    expect(calculateEffectiveHealing(70, 100, 50)).toBe(30)
    expect(calculateEffectiveHealing(100, 100, 50)).toBe(0)
    expect(calculateEffectiveHealing(20, 100, 15)).toBe(15)
  })
})
