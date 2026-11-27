import { describe, expect, it } from 'vitest'
import { dispatchSkillExecutionPlan } from '@/engine/core/skills/skill-plan-dispatch'
import type { SkillExecutionPlan } from '@/engine/core/skills/skill-execution'

describe('skill execution plan dispatch', () => {
  it('routes healing plans and forwards target and percentage', () => {
    const target = { id: 'ally' }
    const plan: SkillExecutionPlan<typeof target> = { kind: 'heal', target, healPct: 35 }
    const result = dispatchSkillExecutionPlan(plan, {
      heal: (unit, pct) => ({ kind: 'healed', unit, pct }),
      party_buff: () => ({ kind: 'buff' }),
      self_buff: () => ({ kind: 'self_buff' }),
      area_attack: () => ({ kind: 'area' }),
      single_attack: () => ({ kind: 'single' }),
      unsupported: () => ({ kind: 'unsupported' }),
    })
    expect(result).toEqual({ kind: 'healed', unit: target, pct: 35 })
  })

  it('routes group healing plans with all selected targets', () => {
    const targets = [{ id: 'a' }, { id: 'b' }]
    const plan: SkillExecutionPlan<typeof targets[number]> = { kind: 'group_heal', targets, healPct: 20 }
    let receivedTargets: readonly typeof targets[number][] = []
    let receivedPct = 0
    const result = dispatchSkillExecutionPlan(plan, {
      heal: () => 'single',
      group_heal: (units, pct) => { receivedTargets = units; receivedPct = pct; return 'group' },
      party_buff: () => 'buff', self_buff: () => 'self', area_attack: () => 'area',
      single_attack: () => 'attack', unsupported: effect => effect,
    })
    expect(result).toBe('group')
    expect(receivedTargets).toEqual(targets)
    expect(receivedPct).toBe(20)
  })

  it('routes periodic healing plans with their target, percentage and tick count', () => {
    const target = { id: 'ally' }
    const plan: SkillExecutionPlan<typeof target> = { kind: 'heal_over_time', target, healPct: 28, ticks: 3 }
    let receivedTarget: typeof target | null = null
    let receivedPct = 0
    let receivedTicks = 0
    const result = dispatchSkillExecutionPlan(plan, {
      heal: () => 'single',
      heal_over_time: (unit, pct, ticks) => { receivedTarget = unit; receivedPct = pct; receivedTicks = ticks; return 'periodic' },
      party_buff: () => 'buff', self_buff: () => 'self', area_attack: () => 'area',
      single_attack: () => 'attack', unsupported: effect => effect,
    })
    expect(result).toBe('periodic')
    expect(receivedTarget).toEqual(target)
    expect(receivedPct).toBe(28)
    expect(receivedTicks).toBe(3)
  })

  it('routes party buffs and forwards buff type and bonus', () => {
    const plan: SkillExecutionPlan<never> = { kind: 'party_buff', buff: 'def', bonus: 18 }
    const result = dispatchSkillExecutionPlan(plan, {
      heal: () => 'heal',
      party_buff: (buff, bonus) => `${buff}:${bonus}`,
      self_buff: buffs => `self:${buffs.map(buff => `${buff.buff}:${buff.bonus}`).join(',')}`,
      area_attack: () => 'area',
      single_attack: () => 'single',
      unsupported: () => 'unsupported',
    })
    expect(result).toBe('def:18')
  })

  it('routes personal buffs and forwards every stat bonus', () => {
    const buffs = [{ buff: 'atk' as const, bonus: 16 }, { buff: 'def' as const, bonus: 16 }]
    const plan: SkillExecutionPlan<never> = { kind: 'self_buff', buffs }
    const result = dispatchSkillExecutionPlan(plan, {
      heal: () => 'heal',
      party_buff: () => 'party',
      self_buff: values => values.map(value => `${value.buff}:${value.bonus}`).join(','),
      area_attack: () => 'area',
      single_attack: () => 'single',
      unsupported: () => 'unsupported',
    })
    expect(result).toBe('atk:16,def:16')
  })

  it('routes area attacks with their targets and flags', () => {
    const targets = [{ id: 'a' }, { id: 'b' }]
    const plan: SkillExecutionPlan<typeof targets[number]> = {
      kind: 'area_attack', targets, armorPenetration: true, critical: false,
    }
    const result = dispatchSkillExecutionPlan<typeof targets[number], unknown>(plan, {
      heal: () => 'heal',
      party_buff: () => 'buff',
      self_buff: () => 'self-buff',
      area_attack: (units, penetration, critical) => ({ units, penetration, critical }),
      single_attack: () => 'single',
      unsupported: () => 'unsupported',
    })
    expect(result).toEqual({ units: targets, penetration: true, critical: false })
  })

  it('routes single attacks with target and combat flags', () => {
    const target = { id: 'enemy' }
    const plan: SkillExecutionPlan<typeof target> = {
      kind: 'single_attack', target, armorPenetration: false, critical: true,
    }
    const result = dispatchSkillExecutionPlan<typeof target, unknown>(plan, {
      heal: () => 'heal',
      party_buff: () => 'buff',
      self_buff: () => 'self-buff',
      area_attack: () => 'area',
      single_attack: (unit, penetration, critical) => ({ unit, penetration, critical }),
      unsupported: () => undefined,
    })
    expect(result).toEqual({ unit: target, penetration: false, critical: true })
  })

  it('preserves null targets for handlers to decide legacy no-op behavior', () => {
    const plan: SkillExecutionPlan<never> = { kind: 'heal', target: null, healPct: 20 }
    const result = dispatchSkillExecutionPlan<never, string | null>(plan, {
      heal: target => target,
      party_buff: () => 'buff',
      self_buff: () => 'self-buff',
      area_attack: () => 'area',
      single_attack: () => 'single',
      unsupported: () => null,
    })
    expect(result).toBeNull()
  })
})
