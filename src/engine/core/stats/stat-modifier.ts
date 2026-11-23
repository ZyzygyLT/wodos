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

  return (baseValue + flat) * (100 + percentage) / 100
}

export function modifiersForStat(
  modifiers: readonly StatModifier[],
  stat: string
): StatModifier[] {
  return modifiers.filter(modifier => modifier.stat === stat)
}


/**
 * Converts a numeric stat record (for example, equipment bonuses) into
 * deterministic flat modifiers. The caller remains responsible for deciding
 * which record keys represent stats in its domain.
 */
export function statRecordToFlatModifiers(
  values: Readonly<Record<string, number>>,
  source: string,
): StatModifier[] {
  return Object.keys(values).sort().map(stat => ({
    id: `record:${encodeURIComponent(source)}:${encodeURIComponent(stat)}`,
    stat,
    operation: 'flat' as const,
    value: values[stat],
    source,
  }))
}

/**
 * Applies modifiers to a stat record without mutating the input.
 * Stats absent from the base record are initialized at zero.
 */
export function applyStatModifiersToRecord(
  baseValues: Readonly<Record<string, number>>,
  modifiers: readonly StatModifier[],
): Record<string, number> {
  const stats = new Set([
    ...Object.keys(baseValues),
    ...modifiers.map(modifier => modifier.stat),
  ])
  const result: Record<string, number> = {}
  for (const stat of [...stats].sort()) {
    result[stat] = applyStatModifiers(
      baseValues[stat] ?? 0,
      modifiersForStat(modifiers, stat),
    )
  }
  return result
}
