import { describe, expect, it } from 'vitest'
import { resolveIncomingDamage } from '@/engine/core/combat/incoming-damage'

describe('shared incoming damage resolution', () => {
  it('preserves unmodified damage when no reaction is configured', () => {
    expect(resolveIncomingDamage({ damage: 12, currentMp: 4 })).toMatchObject({
      finalDamage: 12, absorbedByBarrier: 0, dodged: false, mpSpent: 0,
    })
  })

  it('blocks half damage using floor rounding', () => {
    expect(resolveIncomingDamage({ damage:  9, defense: 'block', currentMp: 0 }).finalDamage).toBe(4)
  })

  it('absorbs damage with barrier up to available MP', () => {
    expect(resolveIncomingDamage({ damage: 12, defense: 'barrier', currentMp: 5 })).toMatchObject({
      finalDamage: 7, absorbedByBarrier: 5, mpSpent: 5,
    })
  })

  it('uses an injected random source for dodge', () => {
    expect(resolveIncomingDamage({ damage: 10, defense: 'dodge', currentMp: 0, random: { next: () => 0.9 } })).toMatchObject({
      finalDamage: 0, dodged: true,
    })
    expect(resolveIncomingDamage({ damage: 10, defense: 'dodge', currentMp: 0, random: { next: () => 0.1 } })).toMatchObject({
      finalDamage: 10, dodged: false,
    })
  })

  it('requires randomness when dodge is requested', () => {
    expect(() => resolveIncomingDamage({ damage: 10, defense: 'dodge', currentMp: 0 })).toThrow()
  })
})

