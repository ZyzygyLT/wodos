import { describe, expect, it } from 'vitest'
import { resolveStatusApplication } from '@/engine/core/effects/status-application'

describe('pure status application rules', () => {
  it.each([
    ['poison', 100, { type: 'poison', value: 15, rounds: 3 }],
    ['fire', 100, { type: 'burn', value: 20, rounds: 2 }],
    ['holy', 100, { type: 'burn', value: 25, rounds: 2 }],
    ['ice', 100, { type: 'freeze', value: 0, rounds: 1 }],
    ['lightning', 100, { type: 'stun', value: 0, rounds: 1 }],
    ['dark', 100, { type: 'stun', value: 0, rounds: 1 }],
    ['psychological', 100, { type: 'stun', value: 0, rounds: 1 }],
    ['bleed', 100, { type: 'bleed', value: 10, rounds: 3 }],
    ['piercing', 100, { type: 'bleed', value: 10, rounds: 3 }],
  ] as const)('maps %s to its legacy status rule', (damageType, attackValue, expected) => {
    expect(resolveStatusApplication(damageType, attackValue)).toEqual(expected)
  })

  it('preserves minimum one-point periodic potency for low attack values', () => {
    expect(resolveStatusApplication('poison', 1)).toEqual({ type: 'poison', value: 1, rounds: 3 })
    expect(resolveStatusApplication('fire', 1)).toEqual({ type: 'burn', value: 1, rounds: 2 })
    expect(resolveStatusApplication('piercing', 1)).toEqual({ type: 'bleed', value: 1, rounds: 3 })
  })

  it('returns null for damage types without a status rule', () => {
    expect(resolveStatusApplication('physical', 100)).toBeNull()
    expect(resolveStatusApplication('arcane', 100)).toBeNull()
    expect(resolveStatusApplication('healing', 100)).toBeNull()
  })
})
