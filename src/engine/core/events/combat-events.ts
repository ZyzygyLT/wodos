export type CombatEvent =
  | { readonly type: 'attack_started'; readonly actorId: string; readonly targetIds: readonly string[]; readonly actionId?: string }
  | { readonly type: 'attack_resolved'; readonly actorId: string; readonly targetIds: readonly string[]; readonly hit: boolean; readonly critical?: boolean; readonly actionId?: string }
  | { readonly type: 'on_damage'; readonly sourceId: string; readonly targetId: string; readonly damage?: number; readonly actionId?: string }
  | { readonly type: 'healing_applied'; readonly sourceId: string; readonly targetId: string; readonly healing: number; readonly actionId?: string }
  | { readonly type: 'on_death'; readonly sourceId: string; readonly targetId: string; readonly attackerId?: string }
  | { readonly type: 'on_round_start'; readonly round: number; readonly unitId: string }

export type CombatEventType = CombatEvent['type']
export type LegacyPassiveTrigger = 'on_damage' | 'on_death' | 'on_round_start'

export interface CombatEventHandler<T extends CombatEvent = CombatEvent> {
  readonly eventType: T['type']
  handle(event: T): void
}

export interface CombatEventEnvelope {
  readonly sequence: number
  readonly eventId: string
  readonly event: CombatEvent
}

export interface CombatEventJournal {
  readonly schemaVersion: 1
  readonly events: readonly CombatEventEnvelope[]
}

export interface CombatEventJournalIssue {
  readonly code: 'invalid_sequence' | 'duplicate_event_id' | 'duplicate_action_start' | 'missing_action_start' | 'unknown_action_target'
  readonly sequence: number
  readonly message: string
}

export interface CombatActionTrace {
  readonly actionId: string
  readonly actorId: string
  readonly targetIds: readonly string[]
  readonly startedAt: number
  readonly events: readonly CombatEventEnvelope[]
}

export interface CombatTimeline {
  readonly events: readonly CombatEventEnvelope[]
  readonly actions: readonly CombatActionTrace[]
}

export class CombatEventRecorder {
  private readonly records: CombatEventEnvelope[] = []

  record(envelope: CombatEventEnvelope): void {
    const event = envelope.event.type === 'attack_started' || envelope.event.type === 'attack_resolved'
      ? { ...envelope.event, targetIds: [...envelope.event.targetIds] } as CombatEvent
      : { ...envelope.event } as CombatEvent
    this.records.push(Object.freeze({ ...envelope, event: Object.freeze(event) }))
  }

  snapshot(): CombatEventJournal {
    return {
      schemaVersion: 1,
      events: this.records.map(record => ({
        ...record,
        event: record.event.type === 'attack_started' || record.event.type === 'attack_resolved'
          ? { ...record.event, targetIds: [...record.event.targetIds] } as CombatEvent
          : { ...record.event } as CombatEvent,
      })),
    }
  }

  get size(): number {
    return this.records.length
  }
}

export function validateCombatEventJournal(journal: CombatEventJournal): CombatEventJournalIssue[] {
  const issues: CombatEventJournalIssue[] = []
  if (journal.schemaVersion !== 1) {
    return [{ code: 'invalid_sequence', sequence: 0, message: 'Unsupported combat event journal schema' }]
  }
  const eventIds = new Set<string>()
  const actions = new Map<string, Set<string>>()
  for (let index = 0; index < journal.events.length; index += 1) {
    const envelope = journal.events[index]
    const expectedSequence = index + 1
    if (envelope.sequence !== expectedSequence) {
      issues.push({ code: 'invalid_sequence', sequence: envelope.sequence, message: 'Expected event sequence ' + expectedSequence })
    }
    if (!envelope.eventId || eventIds.has(envelope.eventId)) {
      issues.push({ code: 'duplicate_event_id', sequence: envelope.sequence, message: 'Event ID is empty or duplicated' })
    }
    eventIds.add(envelope.eventId)
    const event = envelope.event
    if (event.type === 'attack_started' && event.actionId) {
      if (actions.has(event.actionId)) {
        issues.push({ code: 'duplicate_action_start', sequence: envelope.sequence, message: 'Action ' + event.actionId + ' starts more than once' })
      } else {
        actions.set(event.actionId, new Set(event.targetIds))
      }
    }
  }
  for (const envelope of journal.events) {
    const event = envelope.event
    if (!('actionId' in event) || !event.actionId) continue
    const targets = actions.get(event.actionId)
    if (!targets) {
      issues.push({ code: 'missing_action_start', sequence: envelope.sequence, message: 'No attack_started event for action ' + event.actionId })
      continue
    }
    if (event.type === 'attack_resolved') {
      for (const targetId of event.targetIds) {
        if (!targets.has(targetId)) issues.push({ code: 'unknown_action_target', sequence: envelope.sequence, message: 'Target ' + targetId + ' was not declared by action ' + event.actionId })
      }
    } else if (event.type === 'on_damage' || event.type === 'healing_applied') {
      if (!targets.has(event.targetId)) issues.push({ code: 'unknown_action_target', sequence: envelope.sequence, message: 'Target ' + event.targetId + ' was not declared by action ' + event.actionId })
    }
  }
  return issues
}

export function reconstructCombatTimeline(journal: CombatEventJournal): CombatTimeline {
  const grouped = new Map<string, CombatEventEnvelope[]>()
  const starts = new Map<string, { actorId: string; targetIds: readonly string[]; sequence: number }>()
  for (const envelope of journal.events) {
    const event = envelope.event
    if (!('actionId' in event) || !event.actionId) continue
    const group = grouped.get(event.actionId) ?? []
    group.push(envelope)
    grouped.set(event.actionId, group)
    if (event.type === 'attack_started') {
      starts.set(event.actionId, { actorId: event.actorId, targetIds: [...event.targetIds], sequence: envelope.sequence })
    }
  }
  const actions: CombatActionTrace[] = []
  for (const [actionId, start] of starts) {
    actions.push({
      actionId,
      actorId: start.actorId,
      targetIds: start.targetIds,
      startedAt: start.sequence,
      events: grouped.get(actionId) ?? [],
    })
  }
  return { events: journal.events.map(envelope => ({ ...envelope })), actions }
}

export interface CombatEventDispatchResult {
  readonly dispatched: number
  readonly skippedDuplicates: number
}

/**
 * Synchronous, FIFO event dispatcher. Nested dispatches are queued instead of
 * recursively invoking handlers, preserving a stable event/handler order.
 * Event IDs are optional: only explicitly identified events are deduplicated.
 */
export class CombatEventDispatcher {
  private readonly handlers: CombatEventHandler[] = []
  private readonly queue: Array<{ event: CombatEvent; eventId?: string }> = []
  private readonly processedEventIds = new Set<string>()
  private dispatching = false
  private nextSequence = 0

  constructor(
    handlers: readonly CombatEventHandler[] = [],
    private readonly maxEventsPerDrain = 1000,
    private readonly onDispatched?: (envelope: CombatEventEnvelope) => void,
  ) {
    if (!Number.isSafeInteger(maxEventsPerDrain) || maxEventsPerDrain < 1) {
      throw new RangeError('maxEventsPerDrain must be a positive safe integer')
    }
    this.handlers.push(...handlers)
  }

  addHandler(handler: CombatEventHandler): void {
    this.handlers.push(handler)
  }

  dispatch(event: CombatEvent, eventId?: string): CombatEventDispatchResult {
    if (eventId && this.processedEventIds.has(eventId)) {
      return { dispatched: 0, skippedDuplicates: 1 }
    }

    this.queue.push({ event, ...(eventId ? { eventId } : {}) })
    if (this.dispatching) {
      return { dispatched: 0, skippedDuplicates: 0 }
    }

    this.dispatching = true
    let dispatched = 0
    let skippedDuplicates = 0
    try {
      while (this.queue.length > 0) {
        if (dispatched >= this.maxEventsPerDrain) {
          this.queue.length = 0
          throw new RangeError(`Combat event limit exceeded (${this.maxEventsPerDrain})`)
        }
        const next = this.queue.shift()!
        if (next.eventId && this.processedEventIds.has(next.eventId)) {
          skippedDuplicates++
          continue
        }
        if (next.eventId) this.processedEventIds.add(next.eventId)
        this.nextSequence++
        this.onDispatched?.({ sequence: this.nextSequence, eventId: next.eventId ?? 'combat-event:' + this.nextSequence, event: next.event })
        for (const handler of [...this.handlers]) {
          if (handler.eventType === next.event.type) {
            handler.handle(next.event)
          }
        }
        dispatched++
      }
    } catch (error) {
      this.queue.length = 0
      throw error
    } finally {
      this.dispatching = false
    }
    return { dispatched, skippedDuplicates }
  }

  get sequence(): number {
    return this.nextSequence
  }
}

/** Backwards-compatible one-shot dispatch helper. */
export function dispatchCombatEvent<T extends CombatEvent>(
  event: T,
  handlers: readonly CombatEventHandler[],
): void {
  const dispatcher = new CombatEventDispatcher(handlers)
  dispatcher.dispatch(event)
}
