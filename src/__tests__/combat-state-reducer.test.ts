import { describe, expect, it } from 'vitest'
import {
  reconstructCombatState,
  reduceCombatEvent,
  type CombatStateSnapshot,
} from '@/engine/core/events/combat-state-reducer'

function fixture(): CombatStateSnapshot {
  return {
    schemaVersion: 1,
    level: 1,
    round: 1,
    units: [
      { id: 'hero-1', hp: 100, mp: 40, condition: 'healthy', defeated: false, statusEffects: [] },
      { id: 'enemy-1', hp: 50, mp: 10, condition: 'healthy', defeated: false, statusEffects: [] },
    ],
    buffs: [],
    cooldowns: {},
  }
}

describe('combat state reducer', () => {
  it('applies unit state deltas immutably', () => {
    const initial = fixture()
    const next = reduceCombatEvent(initial, {
      type: 'unit_state_changed',
      unitId: 'enemy-1',
      changes: { hp: 0, condition: 'dead', defeated: true },
    })

    expect(next.units[1]).toMatchObject({ hp: 0, condition: 'dead', defeated: true })
    expect(initial.units[1]).toMatchObject({ hp: 50, condition: 'healthy', defeated: false })
    expect(next).not.toBe(initial)
  })

  it('reconstructs a complete supplied state stream in event order', () => {
    const result = reconstructCombatState(fixture(), [
      { event: { type: 'unit_state_changed', unitId: 'hero-1', changes: { mp: 25 } } },
      { event: { type: 'unit_state_changed', unitId: 'enemy-1', changes: { hp: 18 } } },
      { event: { type: 'combat_state_changed', changes: { round: 2, buffs: [{ type: 'atk', value: 12, remainingRounds: 3, sourceName: 'warcry', side: 'hero' }] } } },
      { event: { type: 'combat_state_changed', changes: { cooldowns: { 'hero-1': { 7: 2 } } } } },
    ])

    expect(result).toMatchObject({
      round: 2,
      units: [{ id: 'hero-1', mp: 25 }, { id: 'enemy-1', hp: 18 }],
      buffs: [{ type: 'atk', value: 12, remainingRounds: 3 }],
      cooldowns: { 'hero-1': { 7: 2 } },
    })
  })

  it('replaces the active level with a full checkpoint and clones nested state', () => {
    const initial: CombatStateSnapshot = {
      schemaVersion: 1, level: 0, round: 0, units: [], buffs: [], cooldowns: {},
    }
    const checkpointUnits = [{
      id: 'hero-1', hp: 75, mp: 22, condition: 'wounded', defeated: false,
      statusEffects: [{ type: 'poison', remainingRounds: 2, value: 3, source: 'enemy-1', sourceName: 'Poison' }],
    }]
    const next = reduceCombatEvent(initial, {
      type: 'combat_state_changed',
      changes: { level: 2, round: 1, units: checkpointUnits, buffs: [], cooldowns: {} },
    })
    checkpointUnits[0].statusEffects[0].value = 99
    expect(next).toMatchObject({
      level: 2, round: 1,
      units: [{ id: 'hero-1', hp: 75, mp: 22, statusEffects: [{ value: 3 }] }],
    })
    expect(initial.units).toEqual([])
  })

  it('keeps semantic-only events as state-neutral observations', () => {
    const initial = fixture()
    const next = reduceCombatEvent(initial, {
      type: 'attack_resolved',
      actorId: 'hero-1',
      targetIds: ['enemy-1'],
      hit: true,
    })
    expect(next).toEqual(initial)
    expect(next).not.toBe(initial)
  })

  it('rejects unknown units and invalid state values', () => {
    expect(() => reduceCombatEvent(fixture(), {
      type: 'unit_state_changed', unitId: 'missing', changes: { hp: 2 },
    })).toThrow('Unknown combat unit')

    expect(() => reduceCombatEvent(fixture(), {
      type: 'unit_state_changed', unitId: 'hero-1', changes: { mp: -1 },
    })).toThrow(RangeError)

    expect(() => reduceCombatEvent(fixture(), {
      type: 'combat_state_changed', changes: { round: -1 },
    })).toThrow(RangeError)
  })

  it('does not retain mutable nested event payloads', () => {
    const initial = fixture()
    const statusEffects = [{ type: 'poison', remainingRounds: 2, value: 3, source: 'enemy-1', sourceName: 'Poison' }]
    const next = reduceCombatEvent(initial, {
      type: 'unit_state_changed', unitId: 'hero-1', changes: { statusEffects },
    })
    statusEffects[0].value = 99
    expect(next.units[0].statusEffects[0].value).toBe(3)
  })
})
