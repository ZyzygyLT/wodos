import { describe, expect, it } from 'vitest'
import { executeEnemyTurnPipeline, executeHeroTurnPipeline } from '@/engine/core/combat/actor-action'

describe('combat actor action pipelines', () => {
  it('runs hero selection, logging, overrides, execution and post-action in legacy order', () => {
    const calls: string[] = []
    const result = executeHeroTurnPipeline({
      selectAction: () => { calls.push('select'); return { skillId: 1 } },
      recordSelection: action => { calls.push(`record:${action.skillId}`) },
      applyCooldownOverride: action => { calls.push('cooldown'); return { ...action, skillId: 2 } },
      applyBuffOverride: action => { calls.push('buff'); return { ...action, skillId: 3 } },
      execute: action => { calls.push(`execute:${action.skillId}`); return { damage: 10 } },
      afterSuccessfulExecution: action => { calls.push(`after:${action.skillId}`) },
    })

    expect(result).toEqual({ damage: 10 })
    expect(calls).toEqual(['select', 'record:1', 'cooldown', 'buff', 'execute:3', 'after:3'])
  })

  it('does not run the post-action hook when hero execution returns null', () => {
    const calls: string[] = []
    const result = executeHeroTurnPipeline({
      selectAction: () => 'attack',
      recordSelection: () => calls.push('record'),
      applyCooldownOverride: action => action,
      applyBuffOverride: action => action,
      execute: () => null,
      afterSuccessfulExecution: () => calls.push('after'),
    })
    expect(result).toBeNull()
    expect(calls).toEqual(['record'])
  })

  it('propagates hero executor errors without running post-action effects', () => {
    const calls: string[] = []
    expect(() => executeHeroTurnPipeline({
      selectAction: () => 'attack',
      recordSelection: () => calls.push('record'),
      applyCooldownOverride: action => action,
      applyBuffOverride: action => action,
      execute: () => { throw new Error('execution failed') },
      afterSuccessfulExecution: () => calls.push('after'),
    })).toThrow('execution failed')
    expect(calls).toEqual(['record'])
  })

  it('does not resolve or execute an enemy definition for a defeated unit', () => {
    const calls: string[] = []
    const result = executeEnemyTurnPipeline({
      isAlive: unit => unit.hp > 0,
      resolveDefinition: () => { calls.push('resolve'); return { id: 1 } },
      execute: () => { calls.push('execute'); return 'done' },
    }, { hp: 0 })
    expect(result).toBeNull()
    expect(calls).toEqual([])
  })

  it('skips unmapped enemies and executes mapped living enemies', () => {
    const calls: string[] = []
    const missing = executeEnemyTurnPipeline({
      isAlive: unit => unit.hp > 0,
      resolveDefinition: unit => { calls.push(`resolve:${unit.id}`); return undefined },
      execute: () => { calls.push('execute'); return 'done' },
    }, { id: 'missing', hp: 10 })
    expect(missing).toBeNull()

    const result = executeEnemyTurnPipeline({
      isAlive: unit => unit.hp > 0,
      resolveDefinition: unit => ({ id: unit.id }),
      execute: (definition, unit) => { calls.push(`execute:${definition.id}:${unit.hp}`); return 'done' },
    }, { id: 'mapped', hp: 10 })
    expect(result).toBe('done')
    expect(calls).toEqual(['resolve:missing', 'execute:mapped:10'])
  })
})
