import { describe, expect, it, vi } from 'vitest'
import {
  CombatEventDispatcher,
  dispatchCombatEvent,
  type CombatEvent,
  type CombatEventHandler,
} from '@/engine/core/events/combat-events'

describe('combat event dispatcher', () => {
  it('dispatches matching handlers in registration order', () => {
    const calls: string[] = []
    const handlers: CombatEventHandler[] = [
      { eventType: 'on_damage', handle: () => calls.push('first') },
      { eventType: 'on_death', handle: () => calls.push('unmatched') },
      { eventType: 'on_damage', handle: () => calls.push('second') },
    ]

    dispatchCombatEvent(
      { type: 'on_damage', sourceId: 'hero', targetId: 'enemy', damage: 12 },
      handlers,
    )
    expect(calls).toEqual(['first', 'second'])
  })

  it('queues nested events in FIFO order instead of recursing', () => {
    const calls: string[] = []
    let dispatcher!: CombatEventDispatcher
    const damageHandler: CombatEventHandler = {
      eventType: 'on_damage',
      handle: () => {
        calls.push('damage:start')
        dispatcher.dispatch({ type: 'healing_applied', sourceId: 'healer', targetId: 'hero', healing: 4 })
        calls.push('damage:end')
      },
    }
    const healHandler: CombatEventHandler = {
      eventType: 'healing_applied',
      handle: () => calls.push('healing'),
    }
    dispatcher = new CombatEventDispatcher([damageHandler, healHandler])

    const result = dispatcher.dispatch({ type: 'on_damage', sourceId: 'hero', targetId: 'enemy' })
    expect(result.dispatched).toBe(2)
    expect(calls).toEqual(['damage:start', 'damage:end', 'healing'])
    expect(dispatcher.sequence).toBe(2)
  })

  it('deduplicates only events with an explicit event id', () => {
    const handler = vi.fn()
    const dispatcher = new CombatEventDispatcher([
      { eventType: 'on_death', handle: handler },
    ])
    const event: CombatEvent = { type: 'on_death', sourceId: 'enemy', targetId: 'enemy' }

    expect(dispatcher.dispatch(event, 'death:enemy')).toEqual({ dispatched: 1, skippedDuplicates: 0 })
    expect(dispatcher.dispatch(event, 'death:enemy')).toEqual({ dispatched: 0, skippedDuplicates: 1 })
    dispatcher.dispatch(event)
    dispatcher.dispatch(event)
    expect(handler).toHaveBeenCalledTimes(3)
  })

  it('supports the expanded combat lifecycle event vocabulary', () => {
    const calls: string[] = []
    const dispatcher = new CombatEventDispatcher([
      { eventType: 'attack_started', handle: () => calls.push('attack') },
      { eventType: 'attack_resolved', handle: () => calls.push('resolved') },
      { eventType: 'healing_applied', handle: () => calls.push('healing') },
      { eventType: 'on_round_start', handle: () => calls.push('round') },
    ])

    dispatcher.dispatch({ type: 'attack_started', actorId: 'h1', targetIds: ['e1'] })
    dispatcher.dispatch({ type: 'attack_resolved', actorId: 'h1', targetIds: ['e1'], hit: true, critical: false })
    dispatcher.dispatch({ type: 'healing_applied', sourceId: 'h1', targetId: 'h2', healing: 8 })
    dispatcher.dispatch({ type: 'on_round_start', unitId: 'h1', round: 2 })
    expect(calls).toEqual(['attack', 'resolved', 'healing', 'round'])
  })

  it('stops runaway event chains at the configured drain limit', () => {
    let dispatcher!: CombatEventDispatcher
    const handler: CombatEventHandler = {
      eventType: 'on_damage',
      handle: () => dispatcher.dispatch({ type: 'on_damage', sourceId: 'a', targetId: 'b' }),
    }
    dispatcher = new CombatEventDispatcher([handler], 3)

    expect(() => dispatcher.dispatch({ type: 'on_damage', sourceId: 'a', targetId: 'b' }))
      .toThrow('Combat event limit exceeded (3)')
    expect(dispatcher.sequence).toBe(3)
  })

  it('validates the event drain limit', () => {
    expect(() => new CombatEventDispatcher([], 0)).toThrow(RangeError)
    expect(() => new CombatEventDispatcher([], 1.5)).toThrow(RangeError)
  })
})
