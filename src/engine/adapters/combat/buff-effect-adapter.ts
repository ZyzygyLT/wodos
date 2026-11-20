import { asEntityId, type EntityId } from '../../core/entities/entity'
import type { GameEffect } from '../../core/effects/effect'
import type { StatModifier } from '../../core/stats/stat-modifier'
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

/** Represents one active Wodos buff as a percentage-point stat modifier. */
export function legacyBuffToStatModifier(buff: LegacyCombatBuff): StatModifier {
  assertBuff(buff)
  const id = `legacy-buff:${buff.side}:${buff.type}:${encodeURIComponent(buff.sourceName)}`
  return {
    id: `${id}:modifier`,
    stat: buff.type === 'atk' ? 'attack' : 'defense',
    operation: 'percent',
    value: buff.value,
    source: 'legacy-group-buffs',
  }
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
    modifiers: [legacyBuffToStatModifier(buff)],
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

/**
 * Converts the strongest active group bonuses into neutral percentage modifiers.
 * The legacy combat formulas interpret both group bonuses as percentage points.
 */
export function legacyGroupBuffsToStatModifiers(
  buffs: readonly LegacyCombatBuff[],
): readonly StatModifier[] {
  const bonuses = { atk: 0, def: 0 }
  for (const buff of buffs) {
    if (buff.remainingRounds !== null && buff.remainingRounds <= 0) continue
    if (buff.type === 'atk') bonuses.atk = Math.max(bonuses.atk, buff.value)
    else bonuses.def = Math.max(bonuses.def, buff.value)
  }

  const modifiers: StatModifier[] = []
  if (bonuses.atk !== 0) {
    modifiers.push({
      id: 'legacy-group-buff:attack',
      stat: 'attack',
      operation: 'percent',
      value: bonuses.atk,
      source: 'legacy-group-buffs',
    })
  }
  if (bonuses.def !== 0) {
    modifiers.push({
      id: 'legacy-group-buff:defense',
      stat: 'defense',
      operation: 'percent',
      value: bonuses.def,
      source: 'legacy-group-buffs',
    })
  }
  return modifiers
}

/** Group bonuses use the strongest active buff, not the sum of all buffs. */
export function calculateLegacyGroupBuffBonuses(
  buffs: readonly LegacyCombatBuff[],
): { atk: number; def: number } {
  const modifiers = legacyGroupBuffsToStatModifiers(buffs)
  return {
    atk: modifiers.find(modifier => modifier.stat === 'attack')?.value ?? 0,
    def: modifiers.find(modifier => modifier.stat === 'defense')?.value ?? 0,
  }
}
