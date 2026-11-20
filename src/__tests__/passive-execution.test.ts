import { describe, expect, it } from 'vitest'
import { planPassiveExecution } from '@/engine/core/combat/passive-execution'
import type { ResolvedPassiveCommand } from '@/engine/adapters/combat/passive-effect-adapter'

const command = (
  targetType: ResolvedPassiveCommand['targetType'],
  effectType: ResolvedPassiveCommand['effectType'] = 'damage',
): ResolvedPassiveCommand => ({
  trigger: 'on_damage',
  effectType,
  targetType,
  value: 10,
  sourceId: 'source',
  sourceName: 'Thorns',
})

const context = {
  sourceId: 'source',
  attackerId: 'attacker',
  heroIds: ['h1', 'h2'],
  enemyIds: ['e1', 'e2'],
}

describe('passive execution planning', () => {
  it('resolves self and attacker targets to stable ids', () => {
    expect(planPassiveExecution(command('self'), context).targetIds).toEqual(['source'])
    expect(planPassiveExecution(command('attacker'), context).targetIds).toEqual(['attacker'])
  })

  it('resolves group targets without mutating the supplied roster', () => {
    const heroes = [...context.heroIds]
    expect(planPassiveExecution(command('all_heroes'), context).targetIds).toEqual(heroes)
    expect(context.heroIds).toEqual(heroes)
    expect(planPassiveExecution(command('all_enemies'), context).targetIds).toEqual(['e1', 'e2'])
  })

  it('returns no attacker target when the triggering attacker is unknown', () => {
    expect(planPassiveExecution(command('attacker'), { ...context, attackerId: undefined }).targetIds).toEqual([])
  })

  it('preserves the legacy unsupported attacker target for buffs', () => {
    expect(planPassiveExecution(command('attacker', 'buff'), context).targetIds).toEqual([])
  })

  it('returns no targets for a missing roster target', () => {
    expect(planPassiveExecution(command('all_heroes'), { ...context, heroIds: [] }).targetIds).toEqual([])
  })
})
