import { describe, expect, it } from 'vitest'
import {
  compareDungeonReplayResults,
  createDungeonReplayRecord,
  runDungeonReplay,
} from '@/lib/combat-engine/dungeon-replay'
import type { DungeonData, HeroData } from '@/lib/combat-engine/dungeon-runner'
import { validateCombatEventJournal } from '@/engine/core/events/combat-events'

function createFixture() {
  const heroes: HeroData[] = [{
    id: 'replay-hero',
    name: 'Replay Hero',
    level: 5,
    attrs: { st: 10, dx: 8, co: 9, wi: 5, in: 5 },
    hpMax: 100,
    mpMax: 40,
    gold: 0,
    combatProfile: { position: 'front', prelimRules: [], roundRules: [], defenseSkills: {} },
    skills: [{
      skillId: 1,
      multiplier: 1,
      manaCost: 0,
      effect: 'attack',
      name: 'Basic attack',
      formula: { attrCoeffs: { st: 10 }, skillRankCoeff: 0, diceCount: 0, diceSides: 0, flatBonus: 100 },
    }],
  }]
  const dungeon: DungeonData = {
    id: 1,
    name: 'Replay Test',
    levels: [{
      number: 1,
      enemies: [{
        id: 10,
        name: 'Replay Dummy',
        icon: '🎯',
        hp: 1,
        mp: 0,
        atk: 0,
        def: 0,
        dx: 0,
        ag: 0,
        level: 1,
        position: 'front',
      }],
      epReward: 10,
      goldReward: 5,
    }],
    epReward: 10,
    goldReward: 5,
    fameReward: 2,
    lootTable: [{ itemId: 99, chance: 1, minQty: 1, maxQty: 1 }],
  }
  return { heroes, dungeon }
}

describe('dungeon replay records', () => {
  it('serializes and replays a complete run deterministically', async () => {
    const { heroes, dungeon } = createFixture()
    const record = createDungeonReplayRecord({
      seed: 20261119,
      heroes,
      dungeon,
      options: { clanBonuses: { all_stats_pct: 10 } },
    })
    const restored = JSON.parse(JSON.stringify(record))

    const first = await runDungeonReplay(restored)
    const second = await runDungeonReplay(restored)

    expect(compareDungeonReplayResults(first, second)).toEqual({ matches: true, difference: null })
    expect(first.victory).toBe(true)
    expect(first.loot).toHaveLength(1)
    expect(first.eventJournal.events.length).toBeGreaterThan(0)
    expect(validateCombatEventJournal(first.eventJournal)).toEqual([])
    expect(first.eventJournal).toEqual(second.eventJournal)
  })

  it('reports the first gameplay divergence with a precise path', async () => {
    const { heroes, dungeon } = createFixture()
    const record = createDungeonReplayRecord({ seed: 42, heroes, dungeon })
    const expected = await runDungeonReplay(record)
    const actual = structuredClone(expected)
    actual.goldGained += 1

    expect(compareDungeonReplayResults(expected, actual)).toEqual({
      matches: false,
      difference: { path: '$.goldGained', expected: expected.goldGained, actual: actual.goldGained },
    })
  })

  it('ignores wall-clock log timestamps', async () => {
    const { heroes, dungeon } = createFixture()
    const record = createDungeonReplayRecord({ seed: 7, heroes, dungeon })
    const expected = await runDungeonReplay(record)
    const actual = structuredClone(expected)
    actual.log[0].timestamp += 5000

    expect(compareDungeonReplayResults(expected, actual)).toEqual({ matches: true, difference: null })
  })

  it('rejects seeds outside the unsigned 32-bit range', () => {
    const { heroes, dungeon } = createFixture()
    expect(() => createDungeonReplayRecord({ seed: -1, heroes, dungeon })).toThrow(RangeError)
    expect(() => createDungeonReplayRecord({ seed: 0x100000000, heroes, dungeon })).toThrow(RangeError)
  })
})
