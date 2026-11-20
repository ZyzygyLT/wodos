import { describe, expect, it } from 'vitest'
import {
  CombatEventDispatcher,
  CombatEventRecorder,
  reconstructCombatTimeline,
  validateCombatEventJournal,
  type CombatEventHandler,
} from '@/engine/core/events/combat-events'

describe('combat event recorder', () => {
  it('records dispatcher order with stable sequence and event IDs', () => {
    const recorder = new CombatEventRecorder()
    const dispatcher = new CombatEventDispatcher([], 1000, envelope => recorder.record(envelope))

    dispatcher.dispatch({ type: 'attack_started', actorId: 'hero-1', targetIds: ['enemy-1'], actionId: 'action-1' }, 'event-1')
    dispatcher.dispatch({ type: 'attack_resolved', actorId: 'hero-1', targetIds: ['enemy-1'], hit: true, actionId: 'action-1' }, 'event-2')
    dispatcher.dispatch({ type: 'on_damage', sourceId: 'hero-1', targetId: 'enemy-1', damage: 12, actionId: 'action-1' }, 'event-3')

    expect(recorder.snapshot().events.map(entry => [entry.sequence, entry.eventId])).toEqual([
      [1, 'event-1'], [2, 'event-2'], [3, 'event-3'],
    ])
  })

  it('records nested dispatches in FIFO processing order', () => {
    const recorder = new CombatEventRecorder()
    let dispatcher: CombatEventDispatcher
    const handler: CombatEventHandler = {
      eventType: 'attack_started',
      handle: () => dispatcher.dispatch({ type: 'on_damage', sourceId: 'hero-1', targetId: 'enemy-1', damage: 3 }, 'nested-event'),
    }
    dispatcher = new CombatEventDispatcher([handler], 1000, envelope => recorder.record(envelope))
    dispatcher.dispatch({ type: 'attack_started', actorId: 'hero-1', targetIds: ['enemy-1'], actionId: 'action-1' }, 'start-event')

    expect(recorder.snapshot().events.map(entry => entry.event.type)).toEqual(['attack_started', 'on_damage'])
    expect(recorder.snapshot().events.map(entry => entry.sequence)).toEqual([1, 2])
  })

  it('reconstructs action traces without losing the original event chronology', () => {
    const recorder = new CombatEventRecorder()
    const dispatcher = new CombatEventDispatcher([], 1000, envelope => recorder.record(envelope))
    dispatcher.dispatch({ type: 'attack_started', actorId: 'hero-1', targetIds: ['enemy-1', 'enemy-2'], actionId: 'action-1' }, 'e1')
    dispatcher.dispatch({ type: 'attack_resolved', actorId: 'hero-1', targetIds: ['enemy-1'], hit: true, actionId: 'action-1' }, 'e2')
    dispatcher.dispatch({ type: 'on_damage', sourceId: 'hero-1', targetId: 'enemy-1', damage: 8, actionId: 'action-1' }, 'e3')
    dispatcher.dispatch({ type: 'attack_resolved', actorId: 'hero-1', targetIds: ['enemy-2'], hit: false, actionId: 'action-1' }, 'e4')

    const journal = JSON.parse(JSON.stringify(recorder.snapshot()))
    const timeline = reconstructCombatTimeline(journal)
    expect(timeline.events.map(entry => entry.sequence)).toEqual([1, 2, 3, 4])
    expect(timeline.actions).toHaveLength(1)
    expect(timeline.actions[0]).toMatchObject({
      actionId: 'action-1',
      actorId: 'hero-1',
      targetIds: ['enemy-1', 'enemy-2'],
      startedAt: 1,
    })
    expect(timeline.actions[0].events.map(entry => entry.event.type)).toEqual([
      'attack_started', 'attack_resolved', 'on_damage', 'attack_resolved',
    ])
    expect(validateCombatEventJournal(journal)).toEqual([])
  })

  it('detects duplicate event IDs, missing action starts, and undeclared targets', () => {
    const journal = {
      schemaVersion: 1 as const,
      events: [
        { sequence: 1, eventId: 'same', event: { type: 'attack_started' as const, actorId: 'hero-1', targetIds: ['enemy-1'], actionId: 'action-1' } },
        { sequence: 2, eventId: 'same', event: { type: 'attack_resolved' as const, actorId: 'hero-1', targetIds: ['enemy-2'], hit: true, actionId: 'action-1' } },
        { sequence: 3, eventId: 'orphan', event: { type: 'on_damage' as const, sourceId: 'hero-1', targetId: 'enemy-1', damage: 2, actionId: 'missing-action' } },
      ],
    }

    expect(validateCombatEventJournal(journal).map(issue => issue.code)).toEqual([
      'duplicate_event_id', 'unknown_action_target', 'missing_action_start',
    ])
  })

  it('does not expose mutable references to the recorder internal event list', () => {
    const recorder = new CombatEventRecorder()
    const targets = ['enemy-1']
    const event = { type: 'attack_started' as const, actorId: 'hero-1', targetIds: targets, actionId: 'action-1' }
    const dispatcher = new CombatEventDispatcher([], 1000, envelope => recorder.record(envelope))
    dispatcher.dispatch(event, 'e1')
    targets.push('enemy-2')
    const snapshot = recorder.snapshot()
    expect(snapshot.events[0].event).toMatchObject({ targetIds: ['enemy-1'] })
  })
})
