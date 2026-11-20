import { describe, expect, it } from 'vitest'
import { resolveSkillExecution, type SkillExecutionInput } from '@/engine/core/skills/skill-execution'
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

  it('returns no healing target when every ally is full or defeated', () => {
    const plan = resolve(
      { skillId: 1, effect: 'heal', healPct: 20 },
      { actor: unit('dead-hero', 0), allies: [unit('full', 100)] },
    )
    expect(plan.kind).toBe('heal')
    if (plan.kind === 'heal') expect(plan.target).toBeNull()
  })

  it('normalizes party attack and defense buffs using legacy rank arithmetic', () => {
    expect(resolve({ skillId: 2, effect: 'party_attack_up', multiplier: 1.5, rank: 3 }))
      .toEqual({ kind: 'party_buff', buff: 'atk', bonus: 21 })
    expect(resolve({ skillId: 3, effect: 'defense_up', multiplier: 1, rank: 2 }))
      .toEqual({ kind: 'party_buff', buff: 'def', bonus: 14 })
  })

  it('returns all living enemies for area attacks', () => {
    const plan = resolve({ skillId: 4, effect: 'aoe_attack' })
    expect(plan.kind).toBe('area_attack')
    if (plan.kind === 'area_attack') {
      expect(plan.targets.map(target => target.id)).toEqual(['enemy-front', 'enemy-rear'])
    }
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
    const first = resolve({ skillId: 7 }, { action, enemies: base.enemies, })
    const second = resolve({ skillId: 7 }, { action, enemies: base.enemies, })
    expect(first.kind).toBe('single_attack')
    expect(second.kind).toBe('single_attack')
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
