import { describe, expect, it } from 'vitest'
import { markUnitDefeated } from '@/engine/core/combat/defeat'

describe('defeat registry', () => {
  it('records a defeated unit once', () => {
    const processed = new Set<string>()
    expect(markUnitDefeated(processed, 'unit-1', true)).toBe(true)
    expect(markUnitDefeated(processed, 'unit-1', true)).toBe(false)
    expect(processed.has('unit-1')).toBe(true)
  })

  it('does not register a living unit', () => {
    const processed = new Set<string>()
    expect(markUnitDefeated(processed, 'unit-1', false)).toBe(false)
    expect(processed.size).toBe(0)
  })

  it('allows distinct units to be processed independently', () => {
    const processed = new Set<string>()
    expect(markUnitDefeated(processed, 'unit-1', true)).toBe(true)
    expect(markUnitDefeated(processed, 'unit-2', true)).toBe(true)
    expect(processed.size).toBe(2)
  })
})
