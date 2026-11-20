import { asEntityId, type EntityId } from '../../core/entities/entity'
import type { GameEffect } from '../../core/effects/effect'
import { advanceEffects } from '../../core/effects/effect-lifecycle'
import { mergeStatusByMaximum } from '../../core/effects/status-stacking'
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
    modifiers: [],
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

/** Wodos applies poison, burn and bleed damage at round start. */
export function calculateLegacyStatusDamage(statuses: readonly LegacyCombatStatusEffect[]): number {
  return calculatePeriodicStatusDamage(statuses)
}

/** Stun and freeze skip the affected unit's turn. */
export function isLegacyCombatUnitDisabled(statuses: readonly LegacyCombatStatusEffect[]): boolean {
  return isTurnPreventedByStatus(statuses)
}

/** Mirrors end-of-round duration decay and removes statuses at zero. */
export function advanceLegacyStatusRound(
  statuses: readonly LegacyCombatStatusEffect[]
): readonly LegacyCombatStatusEffect[] {
  const effects = statuses.map(status => legacyStatusToGameEffect('legacy-combat-unit', status))
  const advanced = advanceEffects(effects, 1)
  return advanced.effects.map(gameEffectToLegacyStatus)
}

export function legacyStatusTargetId(value: string): EntityId {
  return asEntityId(value)
}
