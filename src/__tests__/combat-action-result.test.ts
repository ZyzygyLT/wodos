import { describe, expect, it } from 'vitest'
import { createCombatActionResult } from '../engine/core/combat/action-result'

describe('combat action result', () => {
  it('normalizes and freezes a single-target attack result', () => {
    const result = createCombatActionResult({
      actorId: 'hero-1',
      skillId: 12,
      kind: 'attack',
      outcome: 'critical',
      targets: [{ targetId: 'enemy-1', outcome: 'critical', damageBreakdown: [{ type: 'fire', value: 24 }] }],
      mpCost: 5,
    })

    expect(result.targets).toHaveLength(1)
    expect(result.targets[0].damageBreakdown?.[0].value).toBe(24)
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.targets)).toBe(true)
    expect(Object.isFrozen(result.targets[0])).toBe(true)
  })

  it('preserves the originating action identifier', () => {
    const result = createCombatActionResult({
      actionId: 'action:1:2:3',
      actorId: 'hero-1',
      skillId: 12,
      kind: 'attack',
      outcome: 'hit',
      targets: [{ targetId: 'enemy-1', outcome: 'hit' }],
    })

    expect(result.actionId).toBe('action:1:2:3')
  })

  it('preserves per-target outcomes for area actions', () => {
    const result = createCombatActionResult({
      actorId: 'enemy-1',
      skillId: 3,
      kind: 'attack',
      outcome: 'hit',
      targets: [
        { targetId: 'hero-1', outcome: 'hit', absorbed: 4 },
        { targetId: 'hero-2', outcome: 'miss' },
        { targetId: 'hero-3', outcome: 'critical' },
      ],
    })

    expect(result.targets.map(target => target.outcome)).toEqual(['hit', 'miss', 'critical'])
    expect(result.targets[0].absorbed).toBe(4)
  })

  it('represents healing and support results without inventing targets', () => {
    const result = createCombatActionResult({
      actorId: 'hero-1',
      skillId: 0,
      kind: 'item',
      outcome: 'support',
      healing: { amount: 18, resource: 'hp' },
      itemName: 'potion',
    })

    expect(result.targets).toEqual([])
    expect(result.healing).toEqual({ amount: 18, resource: 'hp' })
    expect(result.itemName).toBe('potion')
  })

  it('rejects invalid actor, skill, cost, healing, and target values', () => {
    expect(() => createCombatActionResult({ actorId: ' ', skillId: 1, kind: 'attack', outcome: 'unknown' })).toThrow()
    expect(() => createCombatActionResult({ actorId: 'hero', skillId: 1.5, kind: 'attack', outcome: 'unknown' })).toThrow()
    expect(() => createCombatActionResult({ actorId: 'hero', skillId: 1, kind: 'attack', outcome: 'unknown', mpCost: -1 })).toThrow()
    expect(() => createCombatActionResult({ actorId: 'hero', skillId: 1, kind: 'heal', outcome: 'support', healing: { amount: -1, resource: 'hp' } })).toThrow()
    expect(() => createCombatActionResult({ actorId: 'hero', skillId: 1, kind: 'attack', outcome: 'hit', targets: [{ targetId: '', outcome: 'hit' }] })).toThrow()
  })
})
