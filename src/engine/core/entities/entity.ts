/** Stable identity shared by engine modules. Persistence adapters own ID generation. */
export type EntityId = string & { readonly __entityId: unique symbol }

export interface GameEntity {
  readonly id: EntityId
  readonly kind: string
  readonly name?: string
}

export function asEntityId(value: string): EntityId {
  if (!value.trim()) throw new Error('Entity id cannot be empty')
  return value as EntityId
}
