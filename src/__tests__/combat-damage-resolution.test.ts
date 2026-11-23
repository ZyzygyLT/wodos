import { describe, expect, it } from 'vitest'
import { resolveEnemyFallbackDamage, resolveFormulaDamage } from '@/engine/core/combat/damage-resolution'

describe('shared damage resolution strategies', () => {
  it('preserves formula damage ordering: group bonus, defense, then resistance', () => {
    expect(resolveFormulaDamage({
      adjustedBase: 100,
      groupAttackBonus: 20,
      targetDefense: 10,
      damageType: 'fire',
      resistances: { fire: 25 },
    })).toMatchObject({
      strategy: 'formula',
      rawDamage: 120,
      effectiveDefense: 10,
      damageAfterDefense: 112,
      resistancePercent: 25,
      finalDamage: 84,
    })
  })

  it('applies the legacy armor penetration reduction before formula defense', () => {
    expect(resolveFormulaDamage({
      adjustedBase: 20,
      groupAttackBonus: 0,
      targetDefense: 20,
      armorPenetration: true,
    })).toMatchObject({ effectiveDefense: 6, damageAfterDefense: 15, finalDamage: 15 })
  })

  it('preserves the separate enemy fallback defense and group-defense formula', () => {
    expect(resolveEnemyFallbackDamage({
      enemyAttack: 100,
      skillMultiplier: 1.2,
      critical: true,
      targetDefense: 10,
      groupDefenseBonus: 50,
      damageType: 'ice',
      resistances: { ice: 20 },
    })).toMatchObject({
      strategy: 'enemy-fallback',
      rawDamage: 180,
      effectiveDefense: 12,
      damageAfterDefense: 168,
      resistancePercent: 20,
      finalDamage: 134,
    })
  })

  it('applies the attacker group bonus to enemy fallback damage', () => {
    const withoutBonus = resolveEnemyFallbackDamage({
      enemyAttack: 100,
      skillMultiplier: 1,
      critical: false,
      targetDefense: 0,
      groupDefenseBonus: 0,
    })
    const withBonus = resolveEnemyFallbackDamage({
      enemyAttack: 100,
      skillMultiplier: 1,
      critical: false,
      targetDefense: 0,
      groupDefenseBonus: 0,
      groupAttackBonus: 25,
    })

    expect(withoutBonus.finalDamage).toBe(100)
    expect(withBonus.rawDamage).toBe(125)
    expect(withBonus.finalDamage).toBe(125)
  })

  it('keeps enemy fallback damage unchanged when no attacker group bonus is supplied', () => {
    expect(resolveEnemyFallbackDamage({
      enemyAttack: 100,
      skillMultiplier: 1,
      critical: false,
      targetDefense: 0,
      groupDefenseBonus: 0,
    }).finalDamage).toBe(100)
  })

  it('retains the legacy minimum of one damage even with full resistance', () => {
    expect(resolveFormulaDamage({
      adjustedBase: 1, groupAttackBonus: 0, targetDefense: 100,
      resistances: { physical: 100 },
    }).finalDamage).toBe(1)
  })
})
