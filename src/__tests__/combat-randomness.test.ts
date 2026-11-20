import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/engine/core/random/random-source'
import { validateCombatEventJournal, type CombatEventHandler } from '@/engine/core/events/combat-events'
import { reconstructCombatState, type CombatStateSnapshot } from '@/engine/core/events/combat-state-reducer'
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
      combatProfile: { position: 'front', prelimRules: [{ itemId: 7 }], roundRules: [], defenseSkills: {} },
      skills: [{
        skillId: 1,
        multiplier: 1,
        manaCost: 0,
        effect: 'attack',
        name: 'Basic attack',
        formula: { attrCoeffs: { st: 10 }, skillRankCoeff: 0, diceCount: 0, diceSides: 0, flatBonus: 100 },
      }],
      consumables: [{ itemId: 7, healHp: 10 }],
    }]
    const dungeon: DungeonData = {
      id: 1,
      name: 'Determinism Test',
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
      lootTable: [{ itemId: 99, chance: 1, minQty: 1, maxQty: 1 }],
    }
    const heroBefore = structuredClone(heroes)
    const dungeonBefore = structuredClone(dungeon)
    const options = { clanBonuses: { all_stats_pct: 10 } }
    const observedEvents: string[] = []
    const startedActionIds: string[] = []
    const resolvedActionIds: string[] = []
    const damageActionIds: string[] = []
    const combatEventHandlers: CombatEventHandler[] = [
      { eventType: 'attack_started', handle: event => { if (event.type === 'attack_started') { observedEvents.push(`attack-start:${event.actorId}:${event.targetIds.join(',')}:${event.actionId}`); if (event.actionId) startedActionIds.push(event.actionId) } } },
      { eventType: 'attack_resolved', handle: event => { if (event.type === 'attack_resolved') { observedEvents.push(`attack-resolved:${event.actorId}:${event.targetIds.join(',')}:${event.hit}:${event.critical ?? 'unknown'}:${event.actionId}`); if (event.actionId) resolvedActionIds.push(event.actionId) } } },
      { eventType: 'on_round_start', handle: event => { if (event.type === 'on_round_start') observedEvents.push(`round:${event.unitId}`) } },
      { eventType: 'on_damage', handle: event => { if (event.type === 'on_damage') { observedEvents.push(`damage:${event.sourceId}->${event.targetId}:${event.damage ?? 0}`); if (event.actionId) damageActionIds.push(event.actionId) } } },
      { eventType: 'healing_applied', handle: event => { if (event.type === 'healing_applied') observedEvents.push(`heal:${event.sourceId}->${event.targetId}:${event.healing}`) } },
      { eventType: 'on_death', handle: event => { if (event.type === 'on_death') observedEvents.push(`death:${event.targetId}`) } },
    ]

    const first = await runDungeon(heroes, dungeon, { ...options, random: createSeededRandom(2026), combatEventHandlers })
    const second = await runDungeon(heroes, dungeon, { ...options, random: createSeededRandom(2026) })
    const withoutTimestamps = (result: Awaited<ReturnType<typeof runDungeon>>) => ({
      ...result,
      log: result.log.map(({ timestamp: _timestamp, ...entry }) => entry),
    })

    expect(withoutTimestamps(first)).toEqual(withoutTimestamps(second))
    expect(heroes).toEqual(heroBefore)
    expect(dungeon).toEqual(dungeonBefore)
    expect(first.victory).toBe(true)
    expect(validateCombatEventJournal(first.eventJournal)).toEqual([])
    const reconstructed = reconstructCombatState({
      schemaVersion: 1, level: 0, round: 0, units: [], buffs: [], cooldowns: {},
    }, first.eventJournal.events)
    expect(first.eventJournal.events[0].event.type).toBe('combat_state_changed')
    if (first.eventJournal.events[0].event.type === 'combat_state_changed') {
      expect(first.eventJournal.events[0].event.changes.units?.length).toBeGreaterThan(0)
    }
    expect(reconstructed.units.filter(unit => unit.id.startsWith('hero-')).map(({ id, hp, mp }) => ({ id, hp, mp })))
      .toEqual(first.heroesFinalState)
    const finalRound = first.levelReports[0].rounds.at(-1)!
    const finalReportedUnits = [...finalRound.stateAfter.heroes, ...finalRound.stateAfter.enemies]
    expect(reconstructed.units.map(({ id, hp, mp }) => ({ id, hp, mp })).sort((a, b) => a.id.localeCompare(b.id)))
      .toEqual(finalReportedUnits.map(({ id, hp, mp }) => ({ id, hp, mp })).sort((a, b) => a.id.localeCompare(b.id)))
    expect(first.eventJournal.events.some(entry => entry.event.type === 'unit_state_changed')).toBe(true)
    expect(first.eventJournal.events.some(entry => entry.event.type === 'combat_state_changed')).toBe(true)
    expect(first.eventJournal.events.some(entry => entry.event.type === 'unit_state_changed' && entry.event.changes.hp === 0 && entry.event.changes.defeated === true)).toBe(true)
    expect(first.levelReports[0].rounds.some(round => round.actions.length > 0)).toBe(true)
    const reportedActions = first.levelReports.flatMap(level => level.rounds.flatMap(round => round.actions))
    expect(reportedActions.every(action => action.combatResult?.actorId === action.actorId)).toBe(true)
    expect(reportedActions.some(action => action.combatResult?.kind === 'attack' && action.combatResult.targets.length > 0)).toBe(true)
    const attackReports = reportedActions.filter(action => action.combatResult?.kind === 'attack')
    expect(attackReports.every(action => !!action.actionId && action.combatResult?.actionId === action.actionId)).toBe(true)
    expect(attackReports.every(action => startedActionIds.includes(action.actionId!))).toBe(true)
    expect(damageActionIds.length).toBeGreaterThan(0)
    expect(damageActionIds.every(actionId => startedActionIds.includes(actionId))).toBe(true)
    expect(observedEvents.some(event => event.startsWith('attack-start:hero-1:enemy_10_0:'))).toBe(true)
    expect(resolvedActionIds).toContain(startedActionIds[0])
    expect(observedEvents.some(event => event.startsWith('attack-resolved:hero-1:enemy_10_0:true:'))).toBe(true)
    expect(observedEvents.some(event => event.startsWith('round:'))).toBe(true)
    expect(observedEvents.some(event => event.startsWith('damage:hero-1->enemy_10_0:') && Number(event.split(':')[2]) > 0)).toBe(true)
    expect(observedEvents).toContain('death:enemy_10_0')
    expect(first.loot).toHaveLength(1)
    expect(first.loot[0]).toMatchObject({ itemId: 99, qty: 1, heroId: 'hero-1' })
    expect(heroes[0].consumables).toEqual([{ itemId: 7, healHp: 10 }])
  })

})
