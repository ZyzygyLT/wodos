import { describe, it, expect } from 'vitest'

const { evalTactics, evalCondition, resolveTarget, buildTurnQueue } = await import('@/lib/combat-engine/tactics-evaluator')
import type { RoundRule, CombatState, CombatUnit } from '@/lib/combat-engine/tactics-evaluator'

const makeHero = (overrides: Partial<CombatUnit> = {}): CombatUnit => ({
  id: 'hero-1',
  name: 'Hero',
  hp: 100,
  maxHp: 100,
  mp: 50,
  maxMp: 50,
  isHero: true,
  isAlly: true,
  position: 'front',
  condition: 'ready',
  ...overrides,
})

const makeEnemy = (id: string, overrides: Partial<CombatUnit> = {}): CombatUnit => ({
  id,
  name: `Enemy ${id}`,
  hp: 50,
  maxHp: 50,
  mp: 20,
  maxMp: 20,
  isHero: false,
  isAlly: false,
  position: 'front',
  condition: 'ready',
  ...overrides,
})

const makeState = (overrides: Partial<CombatState> = {}): CombatState => ({
  hero: makeHero(),
  allies: [],
  enemies: [makeEnemy('e1'), makeEnemy('e2', { hp: 10 })],
  round: 1,
  damagedThisRound: false,
  groupAtkBonus: 0,
  buffs: [],
  groupDefBonus: 0,
  ...overrides,
})

describe('evalCondition', () => {
  it('always returns true', () => {
    expect(evalCondition({ type: 'always' }, makeState())).toBe(true)
  })

  it('hp_self_lt returns true when below threshold', () => {
    const state = makeState({ hero: makeHero({ hp: 20 }) })
    expect(evalCondition({ type: 'hp_self_lt', value: 30 }, state)).toBe(true)
    expect(evalCondition({ type: 'hp_self_lt', value: 10 }, state)).toBe(false)
  })

  it('hp_self_gt returns true when above threshold', () => {
    const state = makeState({ hero: makeHero({ hp: 80 }) })
    expect(evalCondition({ type: 'hp_self_gt', value: 70 }, state)).toBe(true)
    expect(evalCondition({ type: 'hp_self_gt', value: 90 }, state)).toBe(false)
  })

  it('hp_enemy_lt checks weakest alive enemy', () => {
    const state = makeState({
      enemies: [makeEnemy('e1', { hp: 5, maxHp: 50 }), makeEnemy('e2', { hp: 40, maxHp: 50 })],
    })
    expect(evalCondition({ type: 'hp_enemy_lt', value: 25 }, state)).toBe(true)
    expect(evalCondition({ type: 'hp_enemy_lt', value: 5 }, state)).toBe(false)
  })

  it('round_gt triggers after threshold', () => {
    expect(evalCondition({ type: 'round_gt', value: 3 }, makeState({ round: 1 }))).toBe(false)
    expect(evalCondition({ type: 'round_gt', value: 3 }, makeState({ round: 4 }))).toBe(true)
  })

  it('mana_lt returns true when below threshold', () => {
    const state = makeState({ hero: makeHero({ mp: 5, maxMp: 50 }) })
    expect(evalCondition({ type: 'mana_lt', value: 20 }, state)).toBe(true)
    expect(evalCondition({ type: 'mana_lt', value: 5 }, state)).toBe(false)
  })

  it('ally_down when any ally has hp <= 0', () => {
    expect(evalCondition({ type: 'ally_down' }, makeState({ allies: [makeHero({ id: 'a1', hp: 0 })] }))).toBe(true)
    expect(evalCondition({ type: 'ally_down' }, makeState({ allies: [makeHero({ id: 'a1', hp: 1 })] }))).toBe(false)
  })

  it('damaged_this_round', () => {
    expect(evalCondition({ type: 'damaged_this_round' }, makeState({ damagedThisRound: true }))).toBe(true)
    expect(evalCondition({ type: 'damaged_this_round' }, makeState({ damagedThisRound: false }))).toBe(false)
  })

  it('does not trigger resource conditions when maximum HP or MP is invalid', () => {
    const state = makeState({
      hero: makeHero({ hp: 10, maxHp: 0, mp: 0, maxMp: 0 }),
    })
    expect(evalCondition({ type: 'hp_self_lt', value: 30 }, state)).toBe(false)
    expect(evalCondition({ type: 'hp_self_gt', value: 70 }, state)).toBe(false)
    expect(evalCondition({ type: 'mana_lt', value: 20 }, state)).toBe(false)
  })

  it('bounds resource percentages to the valid range', () => {
    const state = makeState({
      hero: makeHero({ hp: 150, maxHp: 100, mp: -5, maxMp: 50 }),
      enemies: [makeEnemy('e1', { hp: 80, maxHp: 0 })],
    })
    expect(evalCondition({ type: 'hp_self_gt', value: 99 }, state)).toBe(true)
    expect(evalCondition({ type: 'mana_lt', value: 1 }, state)).toBe(true)
    expect(evalCondition({ type: 'hp_enemy_lt', value: 25 }, state)).toBe(false)
  })

  it('unknown condition type returns false', () => {
    expect(evalCondition({ type: 'unknown' as any, value: 999 }, makeState())).toBe(false)
  })
})

describe('evalTactics', () => {
  it('returns default action when no rules match', () => {
    const rules: RoundRule[] = [{
      priority: 1,
      condition: { type: 'hp_self_lt', value: 10 },
      action: { skillId: 5, targetPos: 'rear', targetType: 'weakest' },
    }]
    const state = makeState({ hero: makeHero({ hp: 100 }) })
    const result = evalTactics(rules, state)
    expect(result.skillId).toBe(1)
    expect(result.targetType).toBe('weakest')
  })

  it('returns first matching rule in priority order', () => {
    const rules: RoundRule[] = [
      { priority: 2, condition: { type: 'hp_self_lt', value: 50 }, action: { skillId: 3, targetPos: 'auto', targetType: 'weakest' } },
      { priority: 1, condition: { type: 'hp_self_lt', value: 80 }, action: { skillId: 9, targetPos: 'auto', targetType: 'most_injured_ally' } },
    ]
    const state = makeState({ hero: makeHero({ hp: 60 }) })
    const result = evalTactics(rules, state)
    expect(result.skillId).toBe(9) 
  })
})

describe('resolveTarget', () => {
  it('returns null when no enemies alive (non-ally target)', () => {
    const state = makeState({ enemies: [] })
    expect(resolveTarget({ skillId: 1, targetPos: 'auto', targetType: 'weakest' }, state)).toBeNull()
  })

  it('selects weakest enemy', () => {
    const state = makeState({
      enemies: [makeEnemy('e1', { hp: 30 }), makeEnemy('e2', { hp: 10 })],
    })
    const target = resolveTarget({ skillId: 1, targetPos: 'auto', targetType: 'weakest' }, state)
    expect(target?.id).toBe('e2')
  })

  it('selects strongest enemy', () => {
    const state = makeState({
      enemies: [makeEnemy('e1', { hp: 10 }), makeEnemy('e2', { hp: 50 })],
    })
    const target = resolveTarget({ skillId: 1, targetPos: 'auto', targetType: 'strongest' }, state)
    expect(target?.id).toBe('e2')
  })

  it('selects most injured ally', () => {
    const state = makeState({
      allies: [makeHero({ id: 'a1', hp: 40, maxHp: 100 }), makeHero({ id: 'a2', hp: 80, maxHp: 100 })],
    })
    const target = resolveTarget({ skillId: 1, targetPos: 'auto', targetType: 'most_injured_ally' }, state)
    expect(target?.id).toBe('a1')
  })

  it('filters by position', () => {
    const state = makeState({
      enemies: [
        makeEnemy('e1', { position: 'front' }),
        makeEnemy('e2', { position: 'rear', hp: 5 }),
      ],
    })
    const target = resolveTarget({ skillId: 1, targetPos: 'rear', targetType: 'weakest' }, state)
    expect(target?.id).toBe('e2')
  })
})

describe('buildTurnQueue', () => {
  it('returns sorted by initiative descending', () => {
    const hero = { ...makeHero(), attrs: { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 } }
    const enemies = [makeEnemy('e1'), makeEnemy('e2')]
    const queue = buildTurnQueue([hero], enemies)
    expect(queue.length).toBe(3)
    for (let i = 1; i < queue.length; i++) {
      expect(queue[i - 1].initiative).toBeGreaterThanOrEqual(queue[i].initiative)
    }
  })

  it('excludes dead units', () => {
    const hero = makeHero({ hp: 0 })
    const enemies = [makeEnemy('e1', { hp: 0 })]
    const queue = buildTurnQueue([hero], enemies)
    expect(queue.length).toBe(0)
  })
})

describe('buildTurnQueue arena opponent initiative', () => {
  it('uses canonical AGI/PER initiative for hero-derived enemies and keeps fixed initiative for regular enemies', () => {
    const hero = {
      ...makeHero(),
      attrs: { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 },
    }
    const arenaOpponent = makeEnemy('arena-opponent', {
      attrs: { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 20, pe: 10, wi: 10 },
    })
    const regularEnemy = makeEnemy('regular-enemy')
    const queue = buildTurnQueue([hero], [arenaOpponent, regularEnemy], { next: () => 0 })

    expect(queue.map(actor => actor.unit.id)).toEqual(['arena-opponent', 'hero-1', 'regular-enemy'])
    expect(queue.map(actor => actor.initiative)).toEqual([25, 15, 10])
  })

  it('neutralizes invalid hero-derived enemy attributes', () => {
    const invalidArenaOpponent = makeEnemy('arena-opponent', {
      attrs: { ag: Number.NaN, pe: Number.POSITIVE_INFINITY },
    })
    const queue = buildTurnQueue([], [invalidArenaOpponent], { next: () => 0 })

    expect(queue[0]?.initiative).toBe(0)
  })
})
