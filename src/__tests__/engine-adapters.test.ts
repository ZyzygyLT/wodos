import { describe, expect, it } from 'vitest'
import { toActiveEngineAttributes, toEngineAttributeDefinition, itemStatsToModifiers } from '@/engine/adapters'
import { applyStatModifiers } from '@/engine/core'

describe('Prisma engine adapters', () => {
  it('maps persisted attribute definitions without leaking Prisma types into the engine', () => {
    const persisted = {
      name: 'Strength', abbreviation: 'st', minValue: 1, maxValue: 20, archivedAt: null,
    }
    expect(toEngineAttributeDefinition(persisted)).toEqual({
      key: 'st', label: 'Strength', min: 1, max: 20, defaultValue: 1, integer: true,
    })
    expect(toEngineAttributeDefinition(persisted, { defaultValue: () => 5 }).defaultValue).toBe(5)
  })

  it('excludes archived attributes from the active engine catalogue', () => {
    const attributes = [
      { name: 'Strength', abbreviation: 'st', minValue: 1, maxValue: 20, archivedAt: null },
      { name: 'Legacy', abbreviation: 'old', minValue: 0, maxValue: 10, archivedAt: new Date('2020-01-01') },
    ]
    expect(toActiveEngineAttributes(attributes).map(attribute => attribute.key)).toEqual(['st'])
  })

  it('converts finite item stats into flat modifiers and omits healing fields', () => {
    const modifiers = itemStatsToModifiers('sword-1', {
      strength: 3, defense: 2, healHp: 10, malformed: '3', invalid: Number.NaN,
    })
    expect(modifiers.map(modifier => modifier.stat)).toEqual(['strength', 'defense'])
    expect(applyStatModifiers(5, modifiers.filter(modifier => modifier.stat === 'strength'))).toBe(8)
    expect(modifiers[0]).toMatchObject({ id: 'item:sword-1:strength', operation: 'flat', value: 3 })
  })
})
