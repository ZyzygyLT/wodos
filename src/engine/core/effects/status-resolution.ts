export type PeriodicStatusKind = 'poison' | 'burn' | 'bleed'
export type TurnPreventingStatusKind = 'stun' | 'freeze'

export interface StatusEffectRule {
  readonly type: string
  readonly value: number
}

/**
 * Calculates the legacy periodic damage contribution from poison, burn and
 * bleed. HP mutation, damage application, event emission and defeat handling
 * remain responsibilities of the combat adapter.
 */
export function calculatePeriodicStatusDamage(
  statuses: readonly StatusEffectRule[],
): number {
  return statuses.reduce(
    (total, status) =>
      total + (status.type === 'poison' || status.type === 'burn' || status.type === 'bleed'
        ? status.value
        : 0),
    0,
  )
}

/** Returns whether an active status prevents its target from taking a turn. */
export function isTurnPreventedByStatus(
  statuses: readonly Pick<StatusEffectRule, 'type'>[],
): boolean {
  return statuses.some(status => status.type === 'stun' || status.type === 'freeze')
}
