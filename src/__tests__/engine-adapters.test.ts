import { describe, expect, it } from 'vitest'
import { toActiveEngineAttributes, toEngineAttributeDefinition, itemStatsToModifiers, equippedItemsToModifiers } from '@/engine/adapters'
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

  it('collects modifiers only from equipped inventory rows', () => {
    const modifiers = equippedItemsToModifiers([
      { id: 'equipped-1', equipped: true, item: { stats: { strength: 2 } } },
      { id: 'bag-1', equipped: false, item: { stats: { strength: 99 } } },
    ])
    expect(modifiers.map(modifier => modifier.value)).toEqual([2])
  })

  it('converts finite item stats into flat modifiers and omits healing fields', () => {
    const modifiers = itemStatsToModifiers('sword-1', {
      strength: 3, defense: 2, healHp: 10, malformed: '3', invalid: Number.NaN,
    })
    expect(modifiers.map(modifier => modifier.stat)).toEqual(['strength', 'defense'])
    expect(applyStatModifiers(5, modifiers.filter(modifier => modifier.stat === 'strength'))).toBe(8)
    expect(modifiers[0]).toMatchObject({ id: 'item:sword-1:strength', operation: 'flat', value: 3 })
  })

  it('supports explicit resolvers for overrides, runes and upgrades without guessing their persisted rules', () => {
    const item = {
      id: 'hero-item-1',
      itemId: 42,
      equipped: true,
      upgradeLevel: 3,
      statOverrides: { strength: 4 },
      runesIn: [{ runeId: 8 }],
      item: { id: 42, stats: { strength: 2 } },
    }
    const modifiers = equippedItemsToModifiers([item], {
      resolveStatOverrides: row => row.statOverrides as Record<string, unknown>,
      resolveRunes: row => row.runesIn ? { intelligence: 2 } : {},
      resolveUpgrade: row => ({ strength: (row.upgradeLevel ?? 0) * 2 }),
    })

    expect(modifiers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'item:hero-item-1:base:strength', value: 2 }),
      expect.objectContaining({ id: 'item:hero-item-1:override:strength', value: 4 }),
      expect.objectContaining({ id: 'item:hero-item-1:rune:intelligence', value: 2 }),
      expect.objectContaining({ id: 'item:hero-item-1:upgrade:strength', value: 6 }),
    ]))
  })

  it('does not invoke bonus resolvers for unequipped items', () => {
    let calls = 0
    const modifiers = equippedItemsToModifiers([
      { id: 'bag-item', equipped: false, upgradeLevel: 9, item: { stats: { strength: 1 } } },
    ], {
      resolveUpgrade: () => { calls += 1; return { strength: 100 } },
    })
    expect(calls).toBe(0)
    expect(modifiers).toEqual([])
  })
})
