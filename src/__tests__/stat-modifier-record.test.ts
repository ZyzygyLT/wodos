import { describe, expect, it } from 'vitest'
import {
  applyStatModifiers,
  applyStatModifiersToRecord,
  statRecordToFlatModifiers,
} from '@/engine/core/stats/stat-modifier'

describe('stat modifier record helpers', () => {
  it('converts equipment-like numeric records into stable flat modifiers', () => {
    expect(statRecordToFlatModifiers({ dx: 4, st: 7 }, 'equipment')).toEqual([
      {
        id: 'record:equipment:dx',
        stat: 'dx',
        operation: 'flat',
        value: 4,
        source: 'equipment',
      },
      {
        id: 'record:equipment:st',
        stat: 'st',
        operation: 'flat',
        value: 7,
        source: 'equipment',
      },
    ])
  })

  it('applies flat modifiers to existing and newly introduced stats', () => {
    const base = { st: 10, dx: 8 }
    const modifiers = statRecordToFlatModifiers({ st: 3, ag: 5 }, 'equipment')

    expect(applyStatModifiersToRecord(base, modifiers)).toEqual({
      ag: 5,
      dx: 8,
      st: 13,
    })
    expect(base).toEqual({ st: 10, dx: 8 })
  })

  it('preserves the stat pipeline flat-then-percent order', () => {
    const modifiers = [
      { id: 'equip:st', stat: 'st', operation: 'flat' as const, value: 5 },
      { id: 'buff:st', stat: 'st', operation: 'percent' as const, value: 20 },
    ]
    expect(applyStatModifiersToRecord({ st: 10 }, modifiers).st).toBe(18)
    expect(applyStatModifiers(10, modifiers)).toBe(18)
  })

  it('does not mutate base records or modifier inputs', () => {
    const base = Object.freeze({ st: 10 })
    const modifiers = Object.freeze(statRecordToFlatModifiers({ st: 2 }, 'equipment'))
    expect(() => applyStatModifiersToRecord(base, modifiers)).not.toThrow()
    expect(base.st).toBe(10)
    expect(modifiers[0].value).toBe(2)
  })
})
