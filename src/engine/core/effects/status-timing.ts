export type StatusEffectPhase = 'round_start' | 'actor_turn' | 'round_end'

export interface TimedStatusEffect {
  readonly type: string
}

/**
 * Selects statuses whose rules are evaluated at a given combat lifecycle phase.
 *
 * Periodic damage is resolved at round start; incapacitating statuses are
 * checked when the affected actor is about to act. Every finite status is
 * eligible for duration advancement at round end.
 *
 * The function only selects effects. It does not mutate units, apply damage,
 * emit events, or decide turn order.
 */
export function selectStatusEffectsForPhase<T extends TimedStatusEffect>(
  statuses: readonly T[],
  phase: StatusEffectPhase,
): readonly T[] {
  switch (phase) {
    case 'round_start':
      return statuses.filter(status =>
        status.type === 'poison' || status.type === 'burn' || status.type === 'bleed'
      )
    case 'actor_turn':
      return statuses.filter(status =>
        status.type === 'stun' || status.type === 'freeze'
      )
    case 'round_end':
      return statuses
  }
}
