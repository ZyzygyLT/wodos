import { describe, expect, it } from 'vitest'
import { isSupportedSkillEffect, resolveSkillExecution, type SkillExecutionInput } from '@/engine/core/skills/skill-execution'
import { createSeededRandom } from '@/engine/core/random/random-source'
import type { TargetableUnit } from '@/engine/core/skills/target-selection'

type Unit = TargetableUnit & { name: string }
const unit = (id: string, hp: number, maxHp = 100, position = 'front'): Unit => ({
  id, name: id, hp, maxHp, position,
})

const base = {
  actor: unit('hero', 50),
  allies: [unit('ally', 20), unit('ally-full', 100)],
  enemies: [unit('enemy-front', 80), unit('enemy-rear', 10, 100, 'rear')],
  action: { targetPos: 'auto' as const, targetType: 'weakest' as const },
}

const resolve = (skill: SkillExecutionInput<Unit>['skill'], overrides: Partial<SkillExecutionInput<Unit>> = {}) =>
  resolveSkillExecution({ ...base, ...overrides, skill })

describe('central skill execution planning', () => {
  it('selects the most injured living ally for healing and keeps the requested percentage', () => {
    const plan = resolve({ skillId: 1, effect: 'heal', healPct: 35 })
    expect(plan).toEqual({ kind: 'heal', target: base.allies[0], healPct: 35 })
  })

  it('respects an explicit self target for a healing action', () => {
    const plan = resolve(
      { skillId: 16, effect: 'heal', healPct: 20 },
      { action: { ...base.action, targetType: 'self' } },
    )
    expect(plan).toEqual({ kind: 'heal', target: base.actor, healPct: 20 })
  })

  it('supports self-only healing for enemy skills', () => {
    const enemy = unit('enemy', 40)
    const ally = unit('enemy-ally', 5)
    const plan = resolveSkillExecution({
      skill: { skillId: 10, effect: 'heal', healPct: 30, healTarget: 'self' },
      actor: enemy,
      allies: [ally],
      enemies: [unit('hero', 100)],
      action: base.action,
    })
    expect(plan.kind).toBe('heal')
    if (plan.kind === 'heal') expect(plan.target?.id).toBe('enemy')
  })

  it('returns no healing target when every ally is full or defeated', () => {
    const plan = resolve(
      { skillId: 1, effect: 'heal', healPct: 20 },
      { actor: unit('dead-hero', 0), allies: [unit('full', 100)] },
    )
    expect(plan.kind).toBe('heal')
    if (plan.kind === 'heal') expect(plan.target).toBeNull()
  })

  it('keeps malformed healing skills as healing actions without selecting a target', () => {
    const missing = resolve({ skillId: 12, effect: 'heal' })
    const invalid = resolve({ skillId: 13, effect: 'heal', healPct: Number.NaN })
    expect(missing).toEqual({ kind: 'heal', target: null, healPct: 0 })
    expect(invalid).toEqual({ kind: 'heal', target: null, healPct: 0 })
  })

  it('skips healing candidates with invalid or zero maximum HP', () => {
    const plan = resolve(
      { skillId: 14, effect: 'heal', healPct: 25 },
      { actor: unit('invalid', 10, 0), allies: [unit('valid', 50, 100)] },
    )
    expect(plan.kind).toBe('heal')
    if (plan.kind === 'heal') expect(plan.target?.id).toBe('valid')
  })

  it('normalizes invalid buff ranks and multipliers while preserving effect defaults', () => {
    expect(resolve({ skillId: 15, effect: 'party_attack_up', rank: Number.NaN, multiplier: Number.NaN }))
      .toEqual({ kind: 'party_buff', buff: 'atk', bonus: 17 })
  })

  it('normalizes party attack and defense buffs using legacy rank arithmetic', () => {
    expect(resolve({ skillId: 2, effect: 'party_attack_up', multiplier: 1.5, rank: 3 }))
      .toEqual({ kind: 'party_buff', buff: 'atk', bonus: 21 })
    expect(resolve({ skillId: 3, effect: 'defense_up', multiplier: 1, rank: 2 }))
      .toEqual({ kind: 'party_buff', buff: 'def', bonus: 14 })
    expect(resolve({ skillId: 9, effect: 'party_attack_up', multiplier: 1.5, rank: 0 }))
      .toEqual({ kind: 'party_buff', buff: 'atk', bonus: 17 })
  })

  it('marks unimplemented combat effects as unsupported instead of treating them as attacks', () => {
    for (const effect of ['buff', 'debuff', 'taunt', 'mana_drain', 'unknown_effect']) {
      expect(resolve({ skillId: 99, effect })).toEqual({ kind: 'unsupported', effect })
      expect(isSupportedSkillEffect(effect)).toBe(false)
    }
    for (const effect of ['attack', 'armor_penetration', 'critical_attack', 'aoe_attack', 'heal', 'party_attack_up', 'defense_up']) {
      expect(isSupportedSkillEffect(effect)).toBe(true)
    }
  })
  it('returns all living enemies for area attacks', () => {
    const plan = resolve({ skillId: 4, effect: 'aoe_attack' }, { enemies: [...base.enemies, unit('defeated', 0)] })
    expect(plan.kind).toBe('area_attack')
    if (plan.kind === 'area_attack') {
      expect(plan.targets.map(target => target.id)).toEqual(['enemy-front', 'enemy-rear'])
    }
  })

  it('resolves enemy targeting against the opposing hero team', () => {
    const enemy = unit('enemy', 100)
    const plan = resolveSkillExecution({
      skill: { skillId: 11, effect: 'attack' },
      actor: enemy,
      allies: [unit('enemy-ally', 80)],
      enemies: [unit('hero-strong', 90, 100, 'front'), unit('hero-weak', 10, 100, 'rear')],
      action: { targetPos: 'auto', targetType: 'weakest', globalTargeting: true },
    })
    expect(plan.kind).toBe('single_attack')
    if (plan.kind === 'single_attack') expect(plan.target?.id).toBe('hero-weak')
  })

  it('resolves an explicit self target to the acting unit for single-target skills', () => {
    const plan = resolve(
      { skillId: 17, effect: 'attack' },
      { action: { ...base.action, targetType: 'self' } },
    )
    expect(plan).toEqual({
      kind: 'single_attack',
      target: base.actor,
      armorPenetration: false,
      critical: false,
    })
  })

  it('resolves a single target and preserves armor penetration / automatic critical flags', () => {
    const plan = resolve(
      { skillId: 5, effect: 'armor_penetration' },
      { enemies: [unit('target', 10)] },
    )
    expect(plan).toEqual({
      kind: 'single_attack',
      target: unit('target', 10),
      armorPenetration: true,
      critical: false,
    })
    const critical = resolve({ skillId: 6, effect: 'critical_attack' })
    expect(critical.kind).toBe('single_attack')
    if (critical.kind === 'single_attack') expect(critical.critical).toBe(true)
  })

  it('uses injected randomness for random single-target actions', () => {
    const action = { targetPos: 'auto' as const, targetType: 'random' as const }
    const first = resolve({ skillId: 7 }, { action, enemies: base.enemies, random: createSeededRandom(123) })
    const second = resolve({ skillId: 7 }, { action, enemies: base.enemies, random: createSeededRandom(123) })
    expect(first.kind).toBe('single_attack')
    expect(second.kind).toBe('single_attack')
    if (first.kind === 'single_attack' && second.kind === 'single_attack') {
      expect(first.target?.id).toBe(second.target?.id)
    }
  })

  it('does not mutate actor, allies or enemies', () => {
    const actor = unit('hero', 50)
    const allies = [unit('ally', 20)]
    const enemies = [unit('enemy', 10)]
    resolveSkillExecution({
      skill: { skillId: 8, effect: 'heal', healPct: 20 },
      actor, allies, enemies, action: base.action,
    })
    expect(actor.hp).toBe(50)
    expect(allies[0].hp).toBe(20)
    expect(enemies[0].hp).toBe(10)
  })
})
