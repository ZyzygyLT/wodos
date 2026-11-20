import { asEntityId, type EntityId } from '../../core/entities/entity'
import type { GameEffect } from '../../core/effects/effect'
import { advanceEffects } from '../../core/effects/effect-lifecycle'
import { mergeBuffByMaximum } from '../../core/effects/buff-stacking'

export type LegacyCombatBuffType = 'atk' | 'def'
export type LegacyCombatBuffSide = 'hero' | 'enemy'

export interface LegacyCombatBuff {
  readonly type: LegacyCombatBuffType
  readonly value: number
  readonly remainingRounds: number | null
  readonly sourceName: string
  readonly icon?: string
  readonly side: LegacyCombatBuffSide
}

interface LegacyBuffMetadata extends Readonly<Record<string, unknown>> {
  readonly legacyType: LegacyCombatBuffType
  readonly value: number
  readonly sourceName: string
  readonly side: LegacyCombatBuffSide
  readonly icon?: string
}

function assertBuff(buff: LegacyCombatBuff): void {
  if (!Number.isFinite(buff.value)) throw new RangeError('Buff value must be finite')
  if (buff.remainingRounds !== null &&
    (!Number.isSafeInteger(buff.remainingRounds) || buff.remainingRounds < 0)) {
    throw new RangeError('Buff duration must be null or a non-negative safe integer')
  }
  if (!buff.sourceName.trim()) throw new Error('Buff sourceName cannot be empty')
}

function sideEntityId(side: LegacyCombatBuffSide): EntityId {
  return asEntityId(`combat-side:${side}`)
}

/** Maps a Wodos group buff to a neutral engine effect attached to its combat side. */
export function legacyBuffToGameEffect(buff: LegacyCombatBuff): GameEffect {
  assertBuff(buff)
  const targetId = sideEntityId(buff.side)
  const duration = buff.remainingRounds === null
    ? { type: 'permanent' as const }
    : { type: 'rounds' as const, remaining: buff.remainingRounds }
  return {
    id: `legacy-buff:${buff.side}:${buff.type}:${encodeURIComponent(buff.sourceName)}`,
    kind: `combat-buff:${buff.type}:${buff.sourceName}`,
    targetId,
    duration,
    stacking: 'refresh',
    modifiers: [],
    metadata: {
      legacyType: buff.type,
      value: buff.value,
      sourceName: buff.sourceName,
      side: buff.side,
      icon: buff.icon,
    },
  }
}

/** Restores the persisted combat-facing shape from an engine effect. */
export function gameEffectToLegacyBuff(effect: GameEffect): LegacyCombatBuff {
  const metadata = effect.metadata
  if (!metadata || (metadata.legacyType !== 'atk' && metadata.legacyType !== 'def') ||
    typeof metadata.value !== 'number' || typeof metadata.sourceName !== 'string' ||
    (metadata.side !== 'hero' && metadata.side !== 'enemy')) {
    throw new Error(`Effect ${effect.id} does not contain legacy combat buff metadata`)
  }
  if (effect.duration.type !== 'permanent' && effect.duration.type !== 'rounds') {
    throw new Error('Legacy combat buffs require round or permanent duration')
  }
  return {
    type: metadata.legacyType,
    value: metadata.value,
    remainingRounds: effect.duration.type === 'permanent' ? null : effect.duration.remaining,
    sourceName: metadata.sourceName,
    side: metadata.side,
    ...(typeof metadata.icon === 'string' ? { icon: metadata.icon } : {}),
  }
}

/**
 * Preserves Wodos' source/type/side identity and max-value/max-duration rule.
 * A stronger incoming buff replaces both value and duration; otherwise only
 * a longer finite duration refreshes the existing entry.
 */
export function applyLegacyCombatBuff(
  current: readonly LegacyCombatBuff[],
  incoming: LegacyCombatBuff,
): readonly LegacyCombatBuff[] {
  assertBuff(incoming)
  current.forEach(assertBuff)
  return mergeBuffByMaximum(current, incoming)
}

/** Wodos ticks finite group buffs at the beginning of each combat round. */
export function advanceLegacyCombatBuffs(
  current: readonly LegacyCombatBuff[],
): readonly LegacyCombatBuff[] {
  const effects = current.map(legacyBuffToGameEffect)
  const advanced = advanceEffects(effects, 1)
  return advanced.effects.map(gameEffectToLegacyBuff)
}

/** Group bonuses use the strongest active buff, not the sum of all buffs. */
export function calculateLegacyGroupBuffBonuses(
  buffs: readonly LegacyCombatBuff[],
): { atk: number; def: number } {
  let atk = 0
  let def = 0
  for (const buff of buffs) {
    if (buff.remainingRounds !== null && buff.remainingRounds <= 0) continue
    if (buff.type === 'atk') atk = Math.max(atk, buff.value)
    else def = Math.max(def, buff.value)
  }
  return { atk, def }
}
