import { describe, expect, it } from 'vitest'
import {
  compareDungeonConfigurations,
  simulateDungeonBatch,
} from '@/lib/combat-engine/dungeon-batch-simulator'
import type { DungeonData, HeroData } from '@/lib/combat-engine/dungeon-runner'

const heroes: HeroData[] = [{
  id: 'hero-1',
  name: 'Test Hero',
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
  name: 'Batch Test',
  levels: [{
    number: 1,
    enemies: [{
      id: 10,
      name: 'Training Dummy',
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
  lootTable: [],
}

describe('dungeon batch simulator', () => {
  it('runs a seeded batch and aggregates outcomes', async () => {
    const result = await simulateDungeonBatch(heroes, dungeon, { iterations: 4, seed: 2026 })

    expect(result.iterations).toBe(4)
    expect(result.wins + result.losses).toBe(4)
    expect(result.winRate).toBe(1)
    expect(result.runs.map(run => run.seed)).toEqual([2026, 2027, 2028, 2029])
    expect(result.damageByCombatant[0]).toMatchObject({ id: 'hero-1', side: 'heroes' })
    expect(result.damageBySkill[0]).toMatchObject({ skillId: 1, skillName: 'Basic attack' })
  })

  it('produces identical aggregate results for the same seed range', async () => {
    const options = { iterations: 3, seed: 99 }
    const first = await simulateDungeonBatch(heroes, dungeon, options)
    const second = await simulateDungeonBatch(heroes, dungeon, options)
    expect(second).toEqual(first)
  })

  it('compares configurations with paired seeds', async () => {
    const result = await compareDungeonConfigurations(
      heroes,
      dungeon,
      { iterations: 3, seed: 700 },
      {},
    )

    expect(result.candidate.runs.map(run => run.seed)).toEqual(
      result.baseline.runs.map(run => run.seed),
    )
    expect(result.winRateDelta).toBe(0)
    expect(result.averageRoundsDelta).toBe(0)
    expect(result.averageHeroDamageDelta).toBe(0)
    expect(result.averageEnemyDamageDelta).toBe(0)
    expect(result.averageDeathsDelta).toBe(0)
  })

  it('rejects invalid batch sizes and seeds', async () => {
    await expect(simulateDungeonBatch(heroes, dungeon, { iterations: 0, seed: 1 }))
      .rejects.toThrow(RangeError)
    await expect(simulateDungeonBatch(heroes, dungeon, { iterations: 1, seed: -1 }))
      .rejects.toThrow(RangeError)
  })
})
