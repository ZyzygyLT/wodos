export interface BuffStackingEntry {
  readonly type: string
  readonly value: number
  readonly remainingRounds: number | null
  readonly sourceName: string
  readonly side: string
}

/**
 * Merges Wodos-style buffs sharing type, source and side.
 *
 * A stronger incoming buff replaces potency and duration. Otherwise, a longer
 * finite incoming duration refreshes the existing entry. Unrelated buffs keep
 * their order and the merged entry is appended, matching the legacy adapter.
 *
 * The legacy permanent-to-finite refresh behavior is intentionally preserved:
 * a finite incoming duration can replace a permanent duration when its value
 * does not exceed the existing potency.
 */
export function mergeBuffByMaximum<T extends BuffStackingEntry>(
  current: readonly T[],
  incoming: T,
): readonly T[] {
  const matching = current.find(buff =>
    buff.sourceName === incoming.sourceName &&
    buff.type === incoming.type &&
    buff.side === incoming.side
  )

  let merged = incoming
  if (matching) {
    merged = matching as T
    if (incoming.value > matching.value) {
      merged = {
        ...matching,
        value: incoming.value,
        remainingRounds: incoming.remainingRounds,
      } as T
    } else if (incoming.remainingRounds !== null &&
      (matching.remainingRounds === null || matching.remainingRounds < incoming.remainingRounds)) {
      merged = { ...matching, remainingRounds: incoming.remainingRounds } as T
    }
  }

  return [
    ...current.filter(buff =>
      !(buff.sourceName === incoming.sourceName &&
        buff.type === incoming.type &&
        buff.side === incoming.side)
    ),
    merged,
  ]
}
