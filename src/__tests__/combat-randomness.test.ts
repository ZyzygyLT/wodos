import { describe, expect, it } from 'vitest'
import { createSeededRandom } from '@/engine/core/random/random-source'
import { evaluateFormula, rollInitiative } from '@/lib/combat-engine/formulas'
import { buildTurnQueue, resolveTarget, type CombatUnit, type CombatState } from '@/lib/combat-engine/tactics-evaluator'

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
})
