import type { EntityId } from '../entities/entity'
import { isExpired, type GameEffect } from '../effects/effect'
import { applyStatModifiers, type StatModifier } from './stat-modifier'

export interface StatBreakdown {
  readonly base: number
  readonly flatModifiers: readonly StatModifier[]
  readonly percentModifiers: readonly StatModifier[]
  readonly final: number
}

export interface StatPipelineInput {
  readonly entityId: EntityId
  readonly baseStats: Readonly<Record<string, number>>
  readonly modifiers?: readonly StatModifier[]
  readonly effects?: readonly GameEffect[]
}

export interface StatPipelineResult {
  readonly values: Readonly<Record<string, number>>
  readonly breakdown: Readonly<Record<string, StatBreakdown>>
  readonly activeEffectIds: readonly string[]
  readonly ignoredExpiredEffectIds: readonly string[]
}

/**
 * Pure stat aggregation: base values + explicit modifiers + modifiers from active
 * effects targeting this entity. Flat modifiers are applied before percentage points.
 * Rounding, caps, stacking resolution and duration advancement belong to domain rules
 * outside this generic pipeline.
 */
export function calculateStats(input: StatPipelineInput): StatPipelineResult {
  const effects = input.effects ?? []
  const targetedEffects = effects.filter(effect => effect.targetId === input.entityId)
  const activeEffects = targetedEffects.filter(effect => !isExpired(effect))
  const expiredEffects = targetedEffects.filter(isExpired)
  const effectModifiers = activeEffects.flatMap(effect =>
    effect.modifiers.map(modifier => ({
      ...modifier,
      source: modifier.source ?? `effect:${effect.id}`,
      id: modifier.id || `effect:${effect.id}:${modifier.stat}`,
    }))
  )
  const allModifiers = [...(input.modifiers ?? []), ...effectModifiers]
  const statKeys = new Set([...Object.keys(input.baseStats), ...allModifiers.map(modifier => modifier.stat)])
  const values: Record<string, number> = {}
  const breakdown: Record<string, StatBreakdown> = {}

  for (const stat of statKeys) {
    const base = input.baseStats[stat] ?? 0
    if (!Number.isFinite(base)) throw new RangeError(`Base stat ${stat} must be finite`)
    const modifiers = allModifiers.filter(modifier => modifier.stat === stat)
    for (const modifier of modifiers) {
      if (!Number.isFinite(modifier.value)) throw new RangeError(`Modifier ${modifier.id} must be finite`)
    }
    const final = applyStatModifiers(base, modifiers)
    const flatModifiers = modifiers.filter(modifier => modifier.operation === 'flat')
    const percentModifiers = modifiers.filter(modifier => modifier.operation === 'percent')
    values[stat] = final
    breakdown[stat] = { base, flatModifiers, percentModifiers, final }
  }

  return {
    values,
    breakdown,
    activeEffectIds: activeEffects.map(effect => effect.id),
    ignoredExpiredEffectIds: expiredEffects.map(effect => effect.id),
  }
}
