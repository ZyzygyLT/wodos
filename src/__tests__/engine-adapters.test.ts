import { describe, expect, it } from 'vitest'
import {
  toActiveEngineAttributes,
  toEngineAttributeDefinition,
  itemStatsToModifiers,
  equippedItemsToModifiers,
  resolveWodosStatOverrideBonus,
  resolveWodosUpgradeBonus,
  createWodosRuneResolver,
} from '@/engine/adapters'
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

  it('translates replacement-style statOverrides into additive deltas', () => {
    const item = {
      id: 'override-sword', equipped: true,
      statOverrides: { atk: 18, magic: 4, invalid: 'nope' },
      item: { stats: { atk: 10, def: 5, invalid: 3 } },
    }
    expect(resolveWodosStatOverrideBonus(item)).toEqual({ atk: 8, magic: 4 })
    const modifiers = equippedItemsToModifiers([item], {
      resolveStatOverrides: resolveWodosStatOverrideBonus,
    })
    expect(applyStatModifiers(0, modifiers.filter(modifier => modifier.stat === 'atk'))).toBe(18)
    expect(applyStatModifiers(0, modifiers.filter(modifier => modifier.stat === 'def'))).toBe(5)
  })

  it('applies Wodos upgrade scaling after stat replacement', () => {
    const item = {
      id: 'overridden-upgraded-sword', equipped: true, upgradeLevel: 1,
      statOverrides: { atk: 50 },
      item: { stats: { atk: 10, def: 5 } },
    }
    const modifiers = equippedItemsToModifiers([item], {
      resolveStatOverrides: resolveWodosStatOverrideBonus,
      resolveUpgrade: resolveWodosUpgradeBonus,
    })
    expect(applyStatModifiers(0, modifiers.filter(modifier => modifier.stat === 'atk'))).toBe(60)
    expect(applyStatModifiers(0, modifiers.filter(modifier => modifier.stat === 'def'))).toBe(6)
  })

  it('translates Wodos upgrade levels into rounded additive deltas', () => {
    const item = {
      id: 'upgraded-sword', equipped: true, upgradeLevel: 2,
      item: { stats: { atk: 33, def: 10, healHp: 5 } },
    }
    expect(resolveWodosUpgradeBonus(item)).toEqual({ atk: 13, def: 4, healHp: 2 })
    const modifiers = equippedItemsToModifiers([item], { resolveUpgrade: resolveWodosUpgradeBonus })
    expect(modifiers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'item:upgraded-sword:base:atk', value: 33 }),
      expect.objectContaining({ id: 'item:upgraded-sword:upgrade:atk', value: 13 }),
    ]))
    expect(applyStatModifiers(0, modifiers.filter(modifier => modifier.stat === 'atk'))).toBe(46)
  })

  it('resolves socketed runes by persisted itemId and sums duplicate stats', () => {
    const resolveRunes = createWodosRuneResolver(new Map([
      [101, { strength: 2, critChance: 1 }],
      [102, { strength: 3, intelligence: 4 }],
    ]))
    const item = {
      id: 'host-item', equipped: true,
      runesIn: [{ slotIndex: 0, itemId: 101 }, { slotIndex: 1, itemId: 102 }, { slotIndex: 2, itemId: 101 }],
      item: { stats: {} },
    }
    expect(resolveRunes(item)).toEqual({ strength: 7, critChance: 2, intelligence: 4 })
    const modifiers = equippedItemsToModifiers([item], { resolveRunes })
    expect(modifiers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'item:host-item:rune:strength', value: 7 }),
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
