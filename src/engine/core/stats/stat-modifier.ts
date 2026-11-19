export type StatModifierOperation = 'flat' | 'percent'

export interface StatModifier {
  readonly id: string
  readonly stat: string
  readonly operation: StatModifierOperation
  /** Flat amount or percentage points (e.g. 15 means +15%). */
  readonly value: number
  readonly priority?: number
  readonly source?: string
}

/**
 * Applies flat additions, then percentage points, in deterministic order.
 * Priority and id provide stable ordering for future non-commutative operations.
 */
export function applyStatModifiers(baseValue: number, modifiers: readonly StatModifier[]): number {
  const ordered = [...modifiers].sort((a, b) =>
    (a.priority ?? 0) - (b.priority ?? 0) || a.id.localeCompare(b.id)
  )
  const flat = ordered
    .filter(modifier => modifier.operation === 'flat')
    .reduce((total, modifier) => total + modifier.value, 0)
  const percentage = ordered
    .filter(modifier => modifier.operation === 'percent')
    .reduce((total, modifier) => total + modifier.value, 0)

  return (baseValue + flat) * (1 + percentage / 100)
}

export function modifiersForStat(
  modifiers: readonly StatModifier[],
  stat: string
): StatModifier[] {
  return modifiers.filter(modifier => modifier.stat === stat)
}
