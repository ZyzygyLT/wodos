import { describe, expect, it } from 'vitest'
import { dispatchCombatActorTurn } from '@/engine/core/combat/actor-turn'

describe('combat actor turn dispatch', () => {
  it('routes heroes to the hero executor and forwards actor metadata', () => {
    const actor = { id: 'hero-1', isHero: true, initiative: 18 }
    const unit = { id: 'hero-1', hp: 20 }
    const calls: unknown[][] = []
    const result = dispatchCombatActorTurn({
      actor,
      unit,
      actorIndex: 2,
      totalActors: 5,
      executeHero: (...args) => { calls.push(['hero', ...args]); return 'hero-result' },
      executeEnemy: (...args) => { calls.push(['enemy', ...args]); return 'enemy-result' },
    })

    expect(result).toBe('hero-result')
    expect(calls).toEqual([['hero', unit, actor, 2, 5]])
  })

  it('routes enemies to the enemy executor and forwards actor metadata', () => {
    const actor = { id: 'enemy-1', isHero: false, initiative: 12 }
    const unit = { id: 'enemy-1', hp: 8 }
    const calls: unknown[][] = []
    const result = dispatchCombatActorTurn({
      actor,
      unit,
      actorIndex: 3,
      totalActors: 4,
      executeHero: (...args) => { calls.push(['hero', ...args]); return 'hero-result' },
      executeEnemy: (...args) => { calls.push(['enemy', ...args]); return 'enemy-result' },
    })

    expect(result).toBe('enemy-result')
    expect(calls).toEqual([['enemy', unit, actor, 3, 4]])
  })

  it('propagates side-specific executor errors', () => {
    const actor = { isHero: true }
    expect(() => dispatchCombatActorTurn({
      actor,
      unit: {},
      actorIndex: 0,
      totalActors: 1,
      executeHero: () => { throw new Error('hero action failed') },
      executeEnemy: () => 'unused',
    })).toThrow('hero action failed')
  })
})
