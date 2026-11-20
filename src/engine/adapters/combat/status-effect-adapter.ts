import { asEntityId, type EntityId } from '../../core/entities/entity'
import type { GameEffect } from '../../core/effects/effect'
import { applyStatModifiers, type StatModifier } from '../../core/stats/stat-modifier'
import { advanceEffects } from '../../core/effects/effect-lifecycle'
import { mergeStatusByMaximum } from '../../core/effects/status-stacking'
import { selectStatusEffectsForPhase } from '../../core/effects/status-timing'
import { calculatePeriodicStatusDamage, isTurnPreventedByStatus } from '../../core/effects/status-resolution'

export type LegacyCombatStatusType =
  | 'poison' | 'burn' | 'bleed' | 'stun' | 'freeze'
  | 'atk_up' | 'def_up' | 'shield' | 'regen'

export interface LegacyCombatStatusEffect {
  readonly type: LegacyCombatStatusType
  readonly remainingRounds: number
  readonly value: number
  readonly source: string
  readonly sourceName: string
}

/** Maps only status types that directly modify combat statistics. */
export function legacyStatusToStatModifiers(status: LegacyCombatStatusEffect): readonly StatModifier[] {
  if (status.type !== 'atk_up' && status.type !== 'def_up') return []
  return [{
    id: `legacy-status-modifier:${status.type}`,
    stat: status.type === 'atk_up' ? 'attack' : 'defense',
    operation: 'percent',
    value: status.value,
    source: 'legacy-status',
  }]
}

/**
 * Resolves active individual status modifiers for one statistic.
 * Expired statuses are ignored; party buffs remain a separate combat mechanic.
 */
export function applyLegacyStatusStatModifiers(
  baseValue: number,
  statuses: readonly LegacyCombatStatusEffect[],
  stat: string,
): number {
  const modifiers = statuses
    .filter(status => status.remainingRounds > 0)
    .flatMap(legacyStatusToStatModifiers)
    .filter(modifier => modifier.stat === stat)
  return applyStatModifiers(baseValue, modifiers)
}

interface LegacyStatusMetadata extends Readonly<Record<string, unknown>> {
  readonly legacyType: LegacyCombatStatusType
  readonly value: number
  readonly source: string
  readonly sourceName: string
}

function metadataOf(effect: GameEffect): LegacyStatusMetadata {
  const metadata = effect.metadata
  if (!metadata || typeof metadata.legacyType !== 'string' ||
    typeof metadata.value !== 'number' || typeof metadata.source !== 'string' ||
    typeof metadata.sourceName !== 'string') {
    throw new Error(`Effect ${effect.id} does not contain legacy combat status metadata`)
  }
  return metadata as LegacyStatusMetadata
}

/** Converts a legacy status to the engine's neutral effect contract. */
export function legacyStatusToGameEffect(targetId: string, status: LegacyCombatStatusEffect): GameEffect {
  if (!Number.isSafeInteger(status.remainingRounds) || status.remainingRounds < 0) {
    throw new RangeError('Status duration must be a non-negative safe integer')
  }
  if (!Number.isFinite(status.value)) throw new RangeError('Status value must be finite')
  const entityId = asEntityId(targetId)
  return {
    id: `legacy-status:${entityId}:${status.type}`,
    kind: `status:${status.type}`,
    targetId: entityId,
    duration: { type: 'rounds', remaining: status.remainingRounds },
    stacking: 'refresh',
    modifiers: legacyStatusToStatModifiers(status),
    metadata: { legacyType: status.type, value: status.value, source: status.source, sourceName: status.sourceName },
  }
}

/** Converts an engine effect back to the legacy combat shape. */
export function gameEffectToLegacyStatus(effect: GameEffect): LegacyCombatStatusEffect {
  const metadata = metadataOf(effect)
  if (effect.duration.type === 'permanent') throw new Error('Legacy combat statuses require finite round durations')
  return {
    type: metadata.legacyType,
    remainingRounds: effect.duration.remaining,
    value: metadata.value,
    source: metadata.source,
    sourceName: metadata.sourceName,
  }
}

/** Mirrors Wodos: one status per type; keep max value and duration and preserve original source. */
export function applyLegacyStatusEffect(
  current: readonly LegacyCombatStatusEffect[],
  incoming: LegacyCombatStatusEffect
): readonly LegacyCombatStatusEffect[] {
  if (!Number.isSafeInteger(incoming.remainingRounds) || incoming.remainingRounds < 0) {
    throw new RangeError('Status duration must be a non-negative safe integer')
  }
  if (!Number.isFinite(incoming.value)) throw new RangeError('Status value must be finite')
  // Preserve legacy validation for every existing status before applying the pure stacking policy.
  current.forEach(status => legacyStatusToGameEffect('legacy-combat-unit', status))
  return mergeStatusByMaximum(current, incoming)
}

/** Only statuses with remaining duration participate in combat resolution. */
function activeLegacyStatuses(statuses: readonly LegacyCombatStatusEffect[]): readonly LegacyCombatStatusEffect[] {
  return statuses.filter(status => status.remainingRounds > 0)
}

/** Wodos applies poison, burn and bleed damage at round start. */
export function calculateLegacyStatusDamage(statuses: readonly LegacyCombatStatusEffect[]): number {
  return calculatePeriodicStatusDamage(selectStatusEffectsForPhase(activeLegacyStatuses(statuses), 'round_start'))
}

/** Stun and freeze skip the affected unit's turn. */
export function isLegacyCombatUnitDisabled(statuses: readonly LegacyCombatStatusEffect[]): boolean {
  return isTurnPreventedByStatus(selectStatusEffectsForPhase(activeLegacyStatuses(statuses), 'actor_turn'))
}

/** Mirrors end-of-round duration decay and removes statuses at zero. */
export function advanceLegacyStatusRound(
  statuses: readonly LegacyCombatStatusEffect[]
): readonly LegacyCombatStatusEffect[] {
  const effects = selectStatusEffectsForPhase(statuses, 'round_end')
    .map(status => legacyStatusToGameEffect('legacy-combat-unit', status))
  const advanced = advanceEffects(effects, 1)
  return advanced.effects.map(gameEffectToLegacyStatus)
}

/**
 * Periodic effects consume duration when their round-start tick is resolved.
 * This ensures an effect applied after the current tick receives its full
 * number of future damage ticks.
 */
export function advanceLegacyPeriodicStatusRound(
  statuses: readonly LegacyCombatStatusEffect[]
): readonly LegacyCombatStatusEffect[] {
  return advanceSelectedLegacyStatuses(statuses, status =>
    status.type === 'poison' || status.type === 'burn' || status.type === 'bleed'
  )
}

/** Non-periodic statuses retain their legacy end-of-round duration lifecycle. */
export function advanceLegacyNonPeriodicStatusRound(
  statuses: readonly LegacyCombatStatusEffect[]
): readonly LegacyCombatStatusEffect[] {
  return advanceSelectedLegacyStatuses(statuses, status =>
    status.type !== 'poison' && status.type !== 'burn' && status.type !== 'bleed'
  )
}

function advanceSelectedLegacyStatuses(
  statuses: readonly LegacyCombatStatusEffect[],
  shouldAdvance: (status: LegacyCombatStatusEffect) => boolean,
): readonly LegacyCombatStatusEffect[] {
  const selected = statuses.filter(shouldAdvance)
  const effects = selected.map(status => legacyStatusToGameEffect('legacy-combat-unit', status))
  const advanced = advanceEffects(effects, 1)
  const advancedById = new Map(advanced.effects.map(effect => [effect.id, gameEffectToLegacyStatus(effect)]))

  return statuses.flatMap(status => {
    if (!shouldAdvance(status)) return [status]
    const id = `legacy-status:legacy-combat-unit:${status.type}`
    const next = advancedById.get(id)
    return next ? [next] : []
  })
}

export function legacyStatusTargetId(value: string): EntityId {
  return asEntityId(value)
}
