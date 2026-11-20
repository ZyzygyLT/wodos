import type { GameEffect } from './effect'

export interface ApplyEffectResult {
  readonly effects: readonly GameEffect[]
  /** ID of the effect that is active after the operation (may be the refreshed ID). */
  readonly appliedEffectId: string
  readonly removedEffectIds: readonly string[]
}

export interface AdvanceEffectsResult {
  readonly effects: readonly GameEffect[]
  readonly expiredEffectIds: readonly string[]
}

function assertUniqueIds(effects: readonly GameEffect[]): void {
  const ids = new Set<string>()
  for (const effect of effects) {
    if (!effect.id.trim()) throw new Error('Effect id cannot be empty')
    if (ids.has(effect.id)) throw new Error(`Duplicate effect id: ${effect.id}`)
    ids.add(effect.id)
  }
}

function assertDuration(effect: GameEffect): void {
  if (effect.duration.type === 'permanent') return
  if (!Number.isSafeInteger(effect.duration.remaining) || effect.duration.remaining < 0) {
    throw new RangeError(`Effect ${effect.id} duration must be a non-negative safe integer`)
  }
}

/**
 * Applies the incoming effect's stacking policy against effects with the same
 * target and kind. "refresh" preserves the existing instance and modifiers but
 * resets its duration; "replace" installs the incoming instance; "stack" adds
 * an independent instance. No implicit stacking key or global cap is assumed.
 */
export function applyEffect(
  current: readonly GameEffect[],
  incoming: GameEffect
): ApplyEffectResult {
  assertUniqueIds(current)
  assertDuration(incoming)
  for (const effect of current) assertDuration(effect)

  const matching = current.filter(effect =>
    effect.targetId === incoming.targetId && effect.kind === incoming.kind
  )
  const matchingIds = new Set(matching.map(effect => effect.id))
  if (current.some(effect => effect.id === incoming.id && !matchingIds.has(effect.id))) {
    throw new Error(`Duplicate effect id: ${incoming.id}`)
  }

  if (incoming.stacking === 'stack' || matching.length === 0) {
    return {
      effects: [...current, incoming],
      appliedEffectId: incoming.id,
      removedEffectIds: [],
    }
  }

  if (incoming.stacking === 'refresh') {
    const [primary, ...duplicates] = matching
    const refreshed: GameEffect = { ...primary, duration: incoming.duration }
    const next = current.map(effect => effect.id === primary.id ? refreshed : effect)
    return {
      effects: next.filter(effect => !duplicates.some(duplicate => duplicate.id === effect.id)),
      appliedEffectId: primary.id,
      removedEffectIds: duplicates.map(effect => effect.id),
    }
  }

  return {
    effects: [...current.filter(effect => !matchingIds.has(effect.id)), incoming],
    appliedEffectId: incoming.id,
    removedEffectIds: matching.map(effect => effect.id),
  }
}

/** Advances finite effects by whole turns/rounds and removes those that expire. */
export function advanceEffects(
  current: readonly GameEffect[],
  elapsed = 1
): AdvanceEffectsResult {
  if (!Number.isSafeInteger(elapsed) || elapsed < 0) {
    throw new RangeError('Elapsed duration must be a non-negative safe integer')
  }
  assertUniqueIds(current)
  for (const effect of current) assertDuration(effect)

  const effects: GameEffect[] = []
  const expiredEffectIds: string[] = []
  for (const effect of current) {
    if (effect.duration.type === 'permanent') {
      effects.push(effect)
      continue
    }
    const remaining = Math.max(0, effect.duration.remaining - elapsed)
    if (remaining === 0) {
      expiredEffectIds.push(effect.id)
    } else {
      effects.push({ ...effect, duration: { ...effect.duration, remaining } })
    }
  }
  return { effects, expiredEffectIds }
}

/** Removes effects by ID without mutating the caller's collection. */
export function removeEffects(
  current: readonly GameEffect[],
  effectIds: readonly string[]
): readonly GameEffect[] {
  const removed = new Set(effectIds)
  return current.filter(effect => !removed.has(effect.id))
}
