import { describe, expect, it } from 'vitest'
import { applyHpDamage, applyHpHealing } from '@/engine/core/combat/health'

describe('shared HP change primitives', () => {
  it('applies damage and floors HP at zero', () => {
    expect(applyHpDamage(20, 7)).toMatchObject({
      previousHp: 20, currentHp: 13, requested: 7, applied: 7,
      changed: true, defeated: false, defeatedNow: false,
    })
    expect(applyHpDamage(5, 12)).toMatchObject({
      previousHp: 5, currentHp: 0, applied: 5,
      changed: true, defeated: true, defeatedNow: true,
    })
  })

  it('does not mark an already defeated unit as newly defeated', () => {
    expect(applyHpDamage(0, 10)).toMatchObject({
      currentHp: 0, applied: 0, defeated: true, defeatedNow: false,
    })
  })

  it('applies healing and caps HP at maxHp', () => {
    expect(applyHpHealing(40, 100, 15)).toMatchObject({
      previousHp: 40, currentHp: 55, requested: 15, applied: 15,
      changed: true, defeated: false, defeatedNow: false,
    })
    expect(applyHpHealing(95, 100, 20)).toMatchObject({
      currentHp: 100, applied: 5, changed: true,
    })
  })

  it('reports the resulting HP when healing starts from zero', () => {
    expect(applyHpHealing(0, 100, 20)).toMatchObject({
      currentHp: 20, applied: 20, defeated: false, defeatedNow: false,
    })
  })

  it('reports no change when damage or healing is zero', () => {
    expect(applyHpDamage(50, 0).changed).toBe(false)
    expect(applyHpHealing(50, 100, 0).changed).toBe(false)
  })
  it('does not allow negative or non-finite damage to heal a unit', () => {
    expect(applyHpDamage(40, -25)).toMatchObject({
      currentHp: 40, requested: -25, applied: 0, changed: false,
    })
    expect(applyHpDamage(40, Number.NaN)).toMatchObject({
      currentHp: 40, applied: 0, changed: false,
    })
  })

  it('does not allow negative or non-finite healing to damage a unit', () => {
    expect(applyHpHealing(40, 100, -25)).toMatchObject({
      currentHp: 40, requested: -25, applied: 0, changed: false,
    })
    expect(applyHpHealing(40, 100, Number.NaN)).toMatchObject({
      currentHp: 40, applied: 0, changed: false,
    })
  })

  it('treats an invalid maximum HP as zero for healing', () => {
    expect(applyHpHealing(40, Number.NaN, 10)).toMatchObject({
      currentHp: 0, applied: -40, defeated: true,
    })
  })

})
