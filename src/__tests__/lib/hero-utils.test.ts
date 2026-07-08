import { describe, it, expect } from 'vitest'

const { mergeAttrs } = await import('@/lib/hero-utils')

describe('mergeAttrs', () => {
  it('adds base attrs and mods', () => {
    const base = { st: 10, co: 8, in: 12, dx: 9, ch: 7, ag: 11, pe: 6, wi: 14 }
    const mods = { st: 2, ag: -1, wi: 0 }
    const result = mergeAttrs(base, mods)
    expect(result).toEqual({
      st: 12, co: 8, in: 12, dx: 9,
      ch: 7, ag: 10, pe: 6, wi: 14,
    })
  })

  it('uses defaults for missing keys', () => {
    const base = { st: 5 }
    const mods = { dx: 3 }
    const result = mergeAttrs(base, mods)
    expect(result).toEqual({
      st: 5, co: 0, in: 0, dx: 3,
      ch: 0, ag: 0, pe: 0, wi: 0,
    })
  })

  it('handles empty mods', () => {
    const base = { st: 10, co: 8, in: 12, dx: 9, ch: 7, ag: 11, pe: 6, wi: 14 }
    expect(mergeAttrs(base, {})).toEqual(base)
  })

  it('always has exactly 8 keys', () => {
    const result = mergeAttrs({}, {})
    expect(Object.keys(result).length).toBe(8)
  })
})
