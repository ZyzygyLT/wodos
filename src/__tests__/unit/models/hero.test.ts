import { describe, it, expect } from 'vitest'
import { validateHeroAttributes } from '@/lib/models/hero'

describe('validateHeroAttributes', () => {
  const ranges = {
    st: { min: 1, max: 100 },
    ag: { min: 1, max: 100 },
    in: { min: 1, max: 100 },
  }

  it('returns no errors for valid values', () => {
    const errors = validateHeroAttributes({ st: 50, ag: 75 }, ranges)
    expect(errors).toEqual([])
  })

  it('returns error for value below minimum', () => {
    const errors = validateHeroAttributes({ st: 0 }, ranges)
    expect(errors).toContain('st value 0 is below minimum 1')
  })

  it('returns error for value above maximum', () => {
    const errors = validateHeroAttributes({ st: 150 }, ranges)
    expect(errors).toContain('st value 150 exceeds maximum 100')
  })

  it('returns error for unknown attribute', () => {
    const errors = validateHeroAttributes({ unknown: 50 }, ranges)
    expect(errors).toContain('Unknown attribute: unknown')
  })

  it('returns error for non-integer value', () => {
    const errors = validateHeroAttributes({ st: 10.5 }, ranges)
    expect(errors).toContain('st must be an integer')
  })
})
