import { describe, expect, it } from 'vitest'
import { buildInitiativeQueue, orderInitiativeQueue, rollCombatInitiative } from '@/engine/core/combat/initiative'
import { createSeededRandom } from '@/engine/core/random/random-source'
import { buildTurnQueue, type CombatUnit } from '@/lib/combat-engine/tactics-evaluator'

const unit = (id: string, hp: number, extra: Partial<CombatUnit> = {}): CombatUnit => ({
  id, name: id, hp, maxHp: 100, mp: 0, maxMp: 0,
  isHero: false, isAlly: false, position: 'front', condition: 'ready',
  ...extra,
})

describe('initiative and turn queue', () => {
  it('rolls the legacy inclusive 0..19 bonus with injected randomness', () => {
    expect(rollCombatInitiative(12, { next: () => 0 })).toBe(12)
    expect(rollCombatInitiative(12, { next: () => 0.999999 })).toBe(31)
    expect(() => rollCombatInitiative(12, { next: () => 1 })).toThrow(RangeError)
  })

  it('orders descending and preserves insertion order for ties without mutating input', () => {
    const input = [
      { id: 'first', initiative: 10 },
      { id: 'second', initiative: 20 },
      { id: 'third', initiative: 10 },
    ]
    const ordered = orderInitiativeQueue(input)
    expect(ordered.map(actor => actor.id)).toEqual(['second', 'first', 'third'])
    expect(input.map(actor => actor.id)).toEqual(['first', 'second', 'third'])
  })

  it('assembles eligible actors in hero-then-enemy order and consumes rolls in that order', () => {
    const calls: number[] = []
    const result = buildInitiativeQueue({
      heroes: [{ id: 'h1', alive: true }, { id: 'h2', alive: false }, { id: 'h3', alive: true }],
      enemies: [{ id: 'e1', alive: true, excluded: true }, { id: 'e2', alive: true, excluded: false }, { id: 'e3', alive: false, excluded: false }],
      isHeroAlive: hero => hero.alive,
      isEnemyAlive: enemy => enemy.alive,
      isEnemyExcluded: enemy => enemy.excluded,
      getHeroInitiativeBase: hero => hero.id === 'h1' ? 10 : 30,
      getEnemyInitiativeBase: () => 20,
      rollInitiative: base => { calls.push(base); return base },
      createHeroActor: (hero, initiative) => ({ id: hero.id, initiative, side: 'hero' }),
      createEnemyActor: (enemy, initiative) => ({ id: enemy.id, initiative, side: 'enemy' }),
    })

    expect(calls).toEqual([10, 30, 20])
    expect(result).toEqual([
      { id: 'h3', initiative: 30, side: 'hero' },
      { id: 'e2', initiative: 20, side: 'enemy' },
      { id: 'h1', initiative: 10, side: 'hero' },
    ])
  })

  it('preserves Wodos defaults, trap exclusion, hero attributes and stable tie order', () => {
    const heroes = [
      unit('h1', 100, { attrs: { ag: 12, pe: 0 } }),
      unit('h2', 100),
      unit('h3', 0, { attrs: { dx: 100 } }),
    ]
    const enemies = [
      unit('trap', 100, { trap: true }),
      unit('enemy-dead', 0),
      unit('enemy', 100),
    ]
    const queue = buildTurnQueue(heroes, enemies, { next: () => 0 })
    expect(queue.map(actor => actor.unit.id)).toEqual(['h1', 'h2', 'enemy'])
    expect(queue[0]).toMatchObject({ initiative: 12, isHero: true, attrs: { ag: 12, pe: 0 } })
    expect(queue[1]).toMatchObject({ initiative: 12, isHero: true, attrs: undefined })
    expect(queue[2]).toMatchObject({ initiative: 10, isHero: false })
  })

  it('uses the same AGI/PER initiative formula for enemies with canonical attributes', () => {
    const enemy = unit('fast-enemy', 100, { attrs: { ag: 14, pe: 8 } })
    const queue = buildTurnQueue([], [enemy], { next: () => 0 })

    expect(queue).toHaveLength(1)
    expect(queue[0]).toMatchObject({ initiative: 18, isHero: false, unit: { id: 'fast-enemy' } })
  })

  it('repeats a complete Wodos queue with the same seed', () => {
    const heroes = [unit('h1', 100, { attrs: { dx: 8, ag: 7 } }), unit('h2', 100)]
    const enemies = [unit('e1', 100), unit('e2', 100)]
    const first = buildTurnQueue(heroes, enemies, createSeededRandom(404))
    const second = buildTurnQueue(heroes, enemies, createSeededRandom(404))
    expect(first.map(({ unit: actor, initiative, isHero }) => [actor.id, initiative, isHero]))
      .toEqual(second.map(({ unit: actor, initiative, isHero }) => [actor.id, initiative, isHero]))
  })
})
