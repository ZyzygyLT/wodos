export type CombatEvent =
  | { readonly type: 'on_damage'; readonly sourceId: string; readonly targetId: string; readonly damage: number }
  | { readonly type: 'on_death'; readonly sourceId: string; readonly targetId: string; readonly attackerId?: string }
  | { readonly type: 'on_round_start'; readonly round: number; readonly unitId: string }

export type CombatEventType = CombatEvent['type']

export interface CombatEventHandler<T extends CombatEvent = CombatEvent> {
  readonly eventType: T['type']
  handle(event: T): void
}

/** Dispatches an event to matching handlers in registration order. */
export function dispatchCombatEvent<T extends CombatEvent>(
  event: T,
  handlers: readonly CombatEventHandler[],
): void {
  for (const handler of handlers) {
    if (handler.eventType === event.type) {
      handler.handle(event)
    }
  }
}
