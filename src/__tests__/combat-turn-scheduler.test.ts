import { describe, expect, it } from 'vitest'
import { executeCombatTurnQueue, type CombatTurnActor } from '@/engine/core/combat/turn-scheduler'

interface Actor extends CombatTurnActor {
  unit: { id: string; hp: number; disabled?: boolean }
}

const actors: Actor[] = [
  { unit: { id: 'hero-1', hp: 10 }, initiative: 20, isHero: true },
  { unit: { id: 'enemy-1', hp: 10, disabled: true }, initiative: 15, isHero: false },
  { unit: { id: 'hero-2', hp: 0 }, initiative: 10, isHero: true },
  { unit: { id: 'enemy-2', hp: 10 }, initiative: 5, isHero: false },
]

describe('combat turn scheduler', () => {
  it('preserves queue order and original actor indices when skipping units', () => {
    const calls: string[] = []
    const result = executeCombatTurnQueue({
      actors,
      resolveUnit: actor => actor.unit,
      isAlive: unit => unit.hp > 0,
      shouldStop: () => false,
      isDisabled: unit => unit.disabled === true,
      onDisabled: (unit, _actor, index) => calls.push(`disabled:${unit.id}:${index}`),
      execute: (unit, _actor, index, total) => calls.push(`execute:${unit.id}:${index}/${total}`),
    })

    expect(calls).toEqual(['execute:hero-1:0/4', 'disabled:enemy-1:1', 'execute:enemy-2:3/4'])
    expect(result).toEqual({
      totalActors: 4,
      visitedActors: 4,
      executedActors: 2,
      skippedActors: 2,
      stoppedEarly: false,
    })
  })

  it('stops before visiting the next actor when the combat condition is met', () => {
    const visited: string[] = []
    let stop = false
    const result = executeCombatTurnQueue({
      actors,
      resolveUnit: actor => actor.unit,
      isAlive: unit => unit.hp > 0,
      shouldStop: () => stop,
      execute: unit => {
        visited.push(unit.id)
        stop = true
      },
    })

    expect(visited).toEqual(['hero-1'])
    expect(result.visitedActors).toBe(1)
    expect(result.executedActors).toBe(1)
    expect(result.stoppedEarly).toBe(true)
  })

  it('handles an empty queue without invoking callbacks', () => {
    let calls = 0
    const result = executeCombatTurnQueue({
      actors: [],
      resolveUnit: () => { calls++; return undefined },
      isAlive: () => { calls++; return true },
      shouldStop: () => { calls++; return false },
      execute: () => { calls++ },
    })

    expect(result).toEqual({
      totalActors: 0,
      visitedActors: 0,
      executedActors: 0,
      skippedActors: 0,
      stoppedEarly: false,
    })
    expect(calls).toBe(0)
  })

  it('propagates callback errors without swallowing them', () => {
    expect(() => executeCombatTurnQueue({
      actors,
      resolveUnit: actor => actor.unit,
      isAlive: () => true,
      shouldStop: () => false,
      execute: () => { throw new Error('turn failed') },
    })).toThrow('turn failed')
  })

  it('does not mutate the supplied queue or its units', () => {
    const before = structuredClone(actors)
    executeCombatTurnQueue({
      actors,
      resolveUnit: actor => actor.unit,
      isAlive: unit => unit.hp > 0,
      shouldStop: () => false,
      execute: () => undefined,
    })
    expect(actors).toEqual(before)
  })
})
