export interface BuffStackingEntry {
  readonly type: string
  readonly value: number
  readonly remainingRounds: number | null
  readonly sourceName: string
  readonly side: string
}

/** Merges buffs sharing Wodos' source/type/side identity. */
export function mergeBuffByMaximum<T extends BuffStackingEntry>(
  current: readonly T[],
  incoming: T,
): readonly T[] {
  const matches = (buff: T) =>
    buff.sourceName === incoming.sourceName &&
    buff.type === incoming.type &&
    buff.side === incoming.side
  const matchingIndices = current
    .map((buff, index) => matches(buff) ? index : -1)
    .filter(index => index >= 0)
  if (matchingIndices.length === 0) return [...current, incoming]

  // Preserve the first matching entry's legacy potency/source metadata, while
  // placing the merged entry at the last matching slot after duplicate cleanup.
  const matching = current[matchingIndices[0]]
  let merged = matching
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

  const lastMatchingIndex = matchingIndices[matchingIndices.length - 1]
  return current.flatMap((buff, index) => {
    if (index === lastMatchingIndex) return [merged]
    return matches(buff) ? [] : [buff]
  })
}
