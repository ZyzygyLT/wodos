export interface StatusStackingEntry {
  readonly type: string
  readonly remainingRounds: number
  readonly value: number
}

/**
 * Applies Wodos' legacy status refresh policy without depending on its status
 * model: one active entry per type, maximum potency and duration, and source
 * metadata retained from the first existing entry.
 *
 * Non-matching entries retain their relative order; the refreshed/new entry is
 * appended, matching the legacy replace lifecycle's ordering.
 */
export function mergeStatusByMaximum<T extends StatusStackingEntry>(
  current: readonly T[],
  incoming: T,
): readonly T[] {
  const matching = current.find(status => status.type === incoming.type)
  const merged: T = matching
    ? {
        ...matching,
        remainingRounds: Math.max(matching.remainingRounds, incoming.remainingRounds),
        value: Math.max(matching.value, incoming.value),
      }
    : incoming

  return [...current.filter(status => status.type !== incoming.type), merged]
}
