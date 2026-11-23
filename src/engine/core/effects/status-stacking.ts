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
 * Duplicate entries collapse into the position of the last matching entry,
 * preserving the relative order of unrelated statuses.
 */
export function mergeStatusByMaximum<T extends StatusStackingEntry>(
  current: readonly T[],
  incoming: T,
): readonly T[] {
  const matching = current.filter(status => status.type === incoming.type)
  if (matching.length === 0) return [...current, incoming]

  const first = matching[0]
  const merged: T = {
    ...first,
    remainingRounds: Math.max(incoming.remainingRounds, ...matching.map(status => status.remainingRounds)),
    value: Math.max(incoming.value, ...matching.map(status => status.value)),
  }
  const lastMatchingIndex = current.reduce(
    (last, status, index) => status.type === incoming.type ? index : last,
    -1,
  )

  return current.flatMap((status, index) => {
    if (status.type !== incoming.type) return [status]
    return index === lastMatchingIndex ? [merged] : []
  })
}
