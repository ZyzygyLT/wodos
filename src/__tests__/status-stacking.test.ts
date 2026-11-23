import { describe, expect, it } from 'vitest'
import { mergeStatusByMaximum } from '@/engine/core/effects/status-stacking'

describe('pure status stacking policy', () => {
  const status = (type: string, value: number, remainingRounds: number, source: string) => ({
    type, value, remainingRounds, source,
  })

  it('keeps the maximum potency and duration while preserving the original source', () => {
    expect(mergeStatusByMaximum(
      [status('poison', 8, 2, 'first caster')],
      status('poison', 12, 5, 'second caster'),
    )).toEqual([status('poison', 12, 5, 'first caster')])
  })

  it('does not lower existing potency or duration on a weaker refresh', () => {
    expect(mergeStatusByMaximum(
      [status('burn', 15, 4, 'original')],
      status('burn', 7, 2, 'new source'),
    )).toEqual([status('burn', 15, 4, 'original')])
  })

  it('removes duplicate entries of the same type and keeps the first source', () => {
    expect(mergeStatusByMaximum(
      [status('poison', 4, 1, 'first'), status('stun', 0, 1, 'other'), status('poison', 9, 3, 'duplicate')],
      status('poison', 7, 2, 'incoming'),
    )).toEqual([
      status('stun', 0, 1, 'other'),
      status('poison', 9, 3, 'first'),
    ])
  })

  it('appends a new status without changing existing entries', () => {
    expect(mergeStatusByMaximum(
      [status('burn', 3, 2, 'fire')],
      status('freeze', 0, 1, 'ice'),
    )).toEqual([
      status('burn', 3, 2, 'fire'),
      status('freeze', 0, 1, 'ice'),
    ])
  })
})
