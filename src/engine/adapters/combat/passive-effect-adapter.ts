import type { LegacyPassiveTrigger } from '../../core/events/combat-events'

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
      value = effect.value.base
      if (effect.value.attrScale && source.attrs?.[effect.value.attrScale]) {
        value += Math.round(source.attrs[effect.value.attrScale] * (effect.value.coeff ?? 0.5))
      } else if (effect.value.coeff) {
        value = Math.round(value * effect.value.coeff)
      }
    }
    // Legacy combat ignores zero/NaN values through its truthiness check.
    if (!value) continue
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
