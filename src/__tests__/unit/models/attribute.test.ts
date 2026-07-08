import { describe, it, expect } from 'vitest'
import { validateAttributeDefinition } from '@/lib/models/attribute'

describe('validateAttributeDefinition', () => {
  it('returns no errors for valid input', () => {
    const errors = validateAttributeDefinition({ name: 'Strength', abbreviation: 'st', minValue: 1, maxValue: 100 })
    expect(errors).toEqual([])
  })

  it('returns error for empty name', () => {
    const errors = validateAttributeDefinition({ name: '', abbreviation: 'st' })
    expect(errors).toContain('Name is required')
  })

  it('returns error for empty abbreviation', () => {
    const errors = validateAttributeDefinition({ name: 'Strength', abbreviation: '' })
    expect(errors).toContain('Abbreviation is required')
  })

  it('returns error when max is not greater than min', () => {
    const errors = validateAttributeDefinition({ name: 'Test', abbreviation: 't', minValue: 50, maxValue: 50 })
    expect(errors).toContain('maxValue must be greater than minValue')
  })

  it('returns error for name over 50 chars', () => {
    const errors = validateAttributeDefinition({ name: 'A'.repeat(51), abbreviation: 'st' })
    expect(errors).toContain('Name must be at most 50 characters')
  })

  it('returns error for abbreviation over 10 chars', () => {
    const errors = validateAttributeDefinition({ name: 'Test', abbreviation: 'ABCDEFGHIJK' })
    expect(errors).toContain('Abbreviation must be at most 10 characters')
  })
})
