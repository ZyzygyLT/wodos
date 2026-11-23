import type { EntityId } from '../entities/entity'
import type { StatModifier } from '../stats/stat-modifier'

export type EffectDuration =
  | { readonly type: 'permanent' }
  | { readonly type: 'turns' | 'rounds'; readonly remaining: number }

export type EffectStacking = 'stack' | 'refresh' | 'replace'

/** Runtime-neutral effect contract; storage and combat decide when duration advances. */
export interface GameEffect {
  readonly id: string
  readonly kind: string
  readonly targetId: EntityId
  readonly duration: EffectDuration
  readonly stacking: EffectStacking
  readonly modifiers: readonly StatModifier[]
  readonly metadata?: Readonly<Record<string, unknown>>
}

export function isExpired(effect: GameEffect): boolean {
  return effect.duration.type !== 'permanent' && effect.duration.remaining <= 0
}
