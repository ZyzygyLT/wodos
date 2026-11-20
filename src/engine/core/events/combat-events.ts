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
