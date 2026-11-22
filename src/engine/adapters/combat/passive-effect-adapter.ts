import type { CombatEventType, LegacyPassiveTrigger } from '../../core/events/combat-events'

export type LegacyPassiveEffectType = 'damage' | 'heal' | 'buff'
export type LegacyPassiveTarget = 'attacker' | 'all_heroes' | 'all_enemies' | 'self'

export interface LegacyPassiveEffect {
  readonly trigger: LegacyPassiveTrigger
  readonly effectType: LegacyPassiveEffectType
  readonly targetType: LegacyPassiveTarget
  readonly value: number | { readonly base: number; readonly coeff?: number; readonly attrScale?: string }
  readonly damageType?: string
  readonly sourceName: string
  readonly buffType?: 'atk' | 'def'
}

export interface PassiveSource {
  readonly id: string
  readonly name: string
  readonly attrs?: Readonly<Record<string, number>>
  readonly passiveEffects?: readonly LegacyPassiveEffect[]
}

export interface ResolvedPassiveCommand {
  readonly trigger: CombatEventType
  readonly effectType: LegacyPassiveEffectType
  readonly targetType: LegacyPassiveTarget
  readonly value: number
  readonly damageType?: string
  readonly sourceId: string
  readonly sourceName: string
  readonly buffType?: 'atk' | 'def'
}

/** Resolves Wodos passive formulas and filters by trigger without applying game side effects. */
export function resolveLegacyPassiveEffects(
  trigger: LegacyPassiveTrigger,
  source: PassiveSource,
): readonly ResolvedPassiveCommand[] {
  const effects = source.passiveEffects?.filter(effect => effect.trigger === trigger) ?? []
  const commands: ResolvedPassiveCommand[] = []
  for (const effect of effects) {
    let value: number
    if (typeof effect.value === 'number') {
      value = effect.value
    } else {
      const base = effect.value.base
      const coeff = effect.value.coeff
      const scaledAttribute = effect.value.attrScale
        ? source.attrs?.[effect.value.attrScale]
        : undefined
      if (!Number.isFinite(base) ||
        (coeff !== undefined && !Number.isFinite(coeff)) ||
        (scaledAttribute !== undefined && !Number.isFinite(scaledAttribute))) {
        continue
      }
      value = base
      if (effect.value.attrScale && scaledAttribute) {
        value += Math.round(scaledAttribute * (coeff ?? 0.5))
      } else if (coeff) {
        value = Math.round(value * coeff)
      }
    }
    // Reject malformed numeric data before it can reach HP or buff mutation.
    if (!Number.isFinite(value) || value === 0) continue
    commands.push({
      trigger,
      effectType: effect.effectType,
      targetType: effect.targetType,
      value,
      ...(effect.damageType ? { damageType: effect.damageType } : {}),
      sourceId: source.id,
      sourceName: effect.sourceName,
      ...(effect.buffType ? { buffType: effect.buffType } : {}),
    })
  }
  return commands
}
