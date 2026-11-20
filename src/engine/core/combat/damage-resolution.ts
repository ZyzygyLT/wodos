import type { DamageType } from '../../../lib/combat-engine/formulas'

export type DamageResistances = Partial<Record<DamageType, number>>

export interface DamageResolutionResult {
  readonly strategy: 'formula' | 'enemy-fallback'
  readonly rawDamage: number
  readonly effectiveDefense: number
  readonly damageAfterDefense: number
  readonly resistancePercent: number
  readonly finalDamage: number
}

/** Existing formula-based Wodos damage path used by hero attacks and formula-backed enemy attacks. */
export function resolveFormulaDamage(input: {
  adjustedBase: number
  groupAttackBonus: number
  targetDefense: number
  armorPenetration?: boolean
  damageType?: DamageType
  resistances?: DamageResistances
}): DamageResolutionResult {
  const effectiveDefense = input.armorPenetration
    ? Math.floor(input.targetDefense * 0.3)
    : input.targetDefense
  const rawDamage = input.adjustedBase * (1 + input.groupAttackBonus / 100)
  const damageAfterDefense = Math.max(1, Math.round(rawDamage - effectiveDefense * 0.8))
  const resistancePercent = (input.resistances?.[input.damageType ?? 'physical'] ?? 0)
  const finalDamage = Math.max(1, Math.round(damageAfterDefense * (1 - resistancePercent / 100)))
  return { strategy: 'formula', rawDamage, effectiveDefense, damageAfterDefense, resistancePercent, finalDamage }
}

/** Preserves the separate legacy fallback formula for enemies without a skill formula. */
export function resolveEnemyFallbackDamage(input: {
  enemyAttack: number
  skillMultiplier: number
  critical: boolean
  targetDefense: number
  groupDefenseBonus: number
  damageType?: DamageType
  resistances?: DamageResistances
}): DamageResolutionResult {
  const criticalMultiplier = input.critical ? 1.5 : 1
  const rawDamage = input.enemyAttack * input.skillMultiplier * criticalMultiplier
  const effectiveDefense = input.targetDefense * 0.8 * (1 + input.groupDefenseBonus / 100)
  const damageAfterDefense = Math.max(1, Math.round(rawDamage - effectiveDefense))
  const resistancePercent = input.resistances?.[input.damageType ?? 'physical'] ?? 0
  const finalDamage = Math.max(1, Math.round(damageAfterDefense * (1 - resistancePercent / 100)))
  return { strategy: 'enemy-fallback', rawDamage, effectiveDefense, damageAfterDefense, resistancePercent, finalDamage }
}
