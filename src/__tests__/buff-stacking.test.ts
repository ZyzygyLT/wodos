import { describe, expect, it } from 'vitest'
import { mergeBuffByMaximum } from '@/engine/core/effects/buff-stacking'

const buff = (
  type: 'atk' | 'def',
  value: number,
  remainingRounds: number | null,
  sourceName = 'Battle cry',
  side: 'hero' | 'enemy' = 'hero',
) => ({ type, value, remainingRounds, sourceName, side })

describe('pure buff stacking policy', () => {
  it('adds a new buff when no matching identity exists', () => {
    expect(mergeBuffByMaximum([], buff('atk', 10, 2))).toEqual([buff('atk', 10, 2)])
  })

  it('uses the stronger incoming value and its duration', () => {
    expect(mergeBuffByMaximum([buff('atk', 10, 4)], buff('atk', 15, 2)))
      .toEqual([buff('atk', 15, 2)])
  })

  it('keeps potency and refreshes to a longer finite duration', () => {
    expect(mergeBuffByMaximum([buff('atk', 15, 2)], buff('atk', 10, 4)))
      .toEqual([buff('atk', 15, 4)])
  })

  it('preserves the legacy permanent-to-finite refresh edge case', () => {
    expect(mergeBuffByMaximum([buff('def', 10, null)], buff('def', 8, 2)))
      .toEqual([buff('def', 10, 2)])
  })

  it('keeps type, source and side as separate identity dimensions', () => {
    const initial = buff('atk', 10, 2)
    expect(mergeBuffByMaximum([initial], buff('def', 12, 2))).toHaveLength(2)
    expect(mergeBuffByMaximum([initial], buff('atk', 12, 2, 'Different source'))).toHaveLength(2)
    expect(mergeBuffByMaximum([initial], buff('atk', 12, 2, 'Battle cry', 'enemy'))).toHaveLength(2)
  })

  it('removes duplicate matching entries and appends the merged result', () => {
    const first = buff('atk', 10, 2)
    const unrelated = buff('def', 8, 3)
    const duplicate = buff('atk', 12, 1)
    expect(mergeBuffByMaximum([first, unrelated, duplicate], buff('atk', 11, 4)))
      .toEqual([unrelated, buff('atk', 12, 4)])
  })
})
