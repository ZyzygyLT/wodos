import { describe, expect, it } from 'vitest'
import { calcActualDamage } from '../lib/combat-engine/formulas'

describe('formula damage group defense', () => {
  it('preserves the existing result when no group defense bonus is supplied', () => {
    expect(calcActualDamage(100, 0, 10)).toBe(92)
    expect(calcActualDamage(100, 0, 10, false, 'physical', {}, 0)).toBe(92)
  })

  it('applies the target side group defense bonus to formula damage', () => {
    const withoutBuff = calcActualDamage(100, 0, 10)
    const withBuff = calcActualDamage(100, 0, 10, false, 'physical', {}, 50)

    expect(withBuff).toBe(88)
    expect(withBuff).toBeLessThan(withoutBuff)
  })

  it('applies group defense before armor penetration is calculated', () => {
    const withoutBuff = calcActualDamage(100, 0, 10, true)
    const withBuff = calcActualDamage(100, 0, 10, true, 'physical', {}, 50)

    expect(withBuff).toBeLessThan(withoutBuff)
  })

  it('applies group defense before resistance is applied', () => {
    const withoutBuff = calcActualDamage(100, 0, 10, false, 'fire', { fire: 50 })
    const withBuff = calcActualDamage(100, 0, 10, false, 'fire', { fire: 50 }, 50)

    expect(withBuff).toBeLessThan(withoutBuff)
  })
})
