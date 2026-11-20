import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/engine/core/random/random-source'
import { evaluateFormula, rollInitiative } from '@/lib/combat-engine/formulas'
import { buildTurnQueue, resolveTarget, type CombatUnit, type CombatState } from '@/lib/combat-engine/tactics-evaluator'
import { runDungeon, type HeroData, type DungeonData } from '@/lib/combat-engine/dungeon-runner'

const unit = (id: string, position: string): CombatUnit => ({
  id, name: id, hp: 100, maxHp: 100, mp: 20, maxMp: 20,
  isHero: false, isAlly: false, position, condition: 'ready',
})

describe('reproducible combat randomness', () => {
  it('repeats formula dice with the same seed', () => {
    const formula = { attrCoeffs: { st: 2 }, skillRankCoeff: 1, diceSides: 8, diceCount: 3, flatBonus: 2 }
    const first = evaluateFormula(formula, { st: 5 }, 4, createSeededRandom(1234))
    const second = evaluateFormula(formula, { st: 5 }, 4, createSeededRandom(1234))
    expect(first).toEqual(second)
  })

  it('repeats initiative rolls with the same seed', () => {
    const first = [rollInitiative(10, createSeededRandom(77)), rollInitiative(10, createSeededRandom(77))]
    const randomA = createSeededRandom(77)
    const randomB = createSeededRandom(77)
    expect(rollInitiative(10, randomA)).toBe(rollInitiative(10, randomB))
  })

  it('repeats turn queue ordering with the same seed', () => {
    const heroes = [unit('h1', 'front'), unit('h2', 'rear')]
    const enemies = [unit('e1', 'front'), unit('e2', 'rear')]
    const first = buildTurnQueue(heroes, enemies, createSeededRandom(900)).map(actor => [actor.unit.id, actor.initiative])
    const second = buildTurnQueue(heroes, enemies, createSeededRandom(900)).map(actor => [actor.unit.id, actor.initiative])
    expect(first).toEqual(second)
  })

  it('repeats random tactical target selection with the same seed', () => {
    const state = {
      hero: unit('hero', 'front'),
      allies: [],
      enemies: [unit('e1', 'front'), unit('e2', 'front'), unit('e3', 'front')],
      round: 1,
      damagedThisRound: false,
    } as CombatState
    const action = { skillId: 1, targetPos: 'front' as const, targetType: 'random' as const }
    const first = resolveTarget(action, state, 'front', [], createSeededRandom(55))
    const second = resolveTarget(action, state, 'front', [], createSeededRandom(55))
    expect(first?.id).toBe(second?.id)
  })

  it('repeats a complete dungeon result with the same seed and leaves inputs unchanged', async () => {
    const heroes: HeroData[] = [{
      id: 'hero-1',
      name: 'Test Hero',
      level: 5,
      attrs: { st: 10, dx: 8, co: 9, wi: 5, in: 5 },
      hpMax: 100,
      mpMax: 40,
      gold: 0,
      combatProfile: { position: 'front', prelimRules: [], roundRules: [], defenseSkills: {} },
      skills: [{ skillId: 1, multiplier: 1, manaCost: 0, effect: 'attack', name: 'Basic attack' }],
    }]
    const dungeon: DungeonData = {
      id: 1,
      name: 'Determinism Test',
      levels: [{ number: 1, enemies: [], epReward: 10, goldReward: 5 }],
      epReward: 10,
      goldReward: 5,
      fameReward: 2,
      lootTable: [{ itemId: 99, chance: 1, minQty: 1, maxQty: 1 }],
    }
    const heroBefore = structuredClone(heroes)
    const dungeonBefore = structuredClone(dungeon)
    const options = { clanBonuses: { all_stats_pct: 10 } }

    const first = await runDungeon(heroes, dungeon, { ...options, random: createSeededRandom(2026) })
    const second = await runDungeon(heroes, dungeon, { ...options, random: createSeededRandom(2026) })
    const withoutTimestamps = (result: Awaited<ReturnType<typeof runDungeon>>) => ({
      ...result,
      log: result.log.map(({ timestamp: _timestamp, ...entry }) => entry),
    })

    expect(withoutTimestamps(first)).toEqual(withoutTimestamps(second))
    expect(heroes).toEqual(heroBefore)
    expect(dungeon).toEqual(dungeonBefore)
    expect(first.loot).toHaveLength(1)
    expect(first.loot[0]).toMatchObject({ itemId: 99, qty: 1, heroId: 'hero-1' })
  })

})
