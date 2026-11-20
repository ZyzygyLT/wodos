import type { CombatEvent } from '../events/combat-events'

export interface CombatStatusSnapshot {
  readonly type: string
  readonly remainingRounds: number
  readonly value: number
  readonly source: string
  readonly sourceName: string
}

export interface CombatUnitSnapshot {
  readonly id: string
  readonly hp: number
  readonly mp: number
  readonly condition: string
  readonly defeated: boolean
  readonly statusEffects: readonly CombatStatusSnapshot[]
}

export interface CombatBuffSnapshot {
  readonly type: string
  readonly value: number
  readonly remainingRounds: number | null
  readonly sourceName: string
  readonly side: string
  readonly icon?: string
}

export interface CombatStateSnapshot {
  readonly schemaVersion: 1
  readonly level: number
  readonly round: number
  readonly units: readonly CombatUnitSnapshot[]
  readonly buffs: readonly CombatBuffSnapshot[]
  readonly cooldowns: Readonly<Record<string, Readonly<Record<number, number>>>>
}

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) throw new RangeError(label + ' must be a non-negative finite number')
}

function cloneUnit(unit: CombatUnitSnapshot): CombatUnitSnapshot {
  return { ...unit, statusEffects: unit.statusEffects.map(effect => ({ ...effect })) }
}

function cloneSnapshot(snapshot: CombatStateSnapshot): CombatStateSnapshot {
  return {
    schemaVersion: 1,
    level: snapshot.level,
    round: snapshot.round,
    units: snapshot.units.map(cloneUnit),
    buffs: snapshot.buffs.map(buff => ({ ...buff })),
    cooldowns: Object.fromEntries(Object.entries(snapshot.cooldowns).map(([unitId, entries]) => [
      unitId,
      Object.fromEntries(Object.entries(entries).map(([skillId, remaining]) => [skillId, remaining])),
    ])),
  }
}

function assertUniqueUnits(units: readonly CombatUnitSnapshot[]): void {
  const ids = new Set<string>()
  for (const unit of units) {
    if (!unit.id.trim() || ids.has(unit.id)) throw new Error('Combat snapshot unit IDs must be non-empty and unique')
    ids.add(unit.id)
    assertNonNegativeFinite(unit.hp, 'Unit HP')
    assertNonNegativeFinite(unit.mp, 'Unit MP')
    if (typeof unit.condition !== 'string') throw new TypeError('Unit condition must be a string')
    if (typeof unit.defeated !== 'boolean') throw new TypeError('Unit defeated must be a boolean')
    for (const effect of unit.statusEffects) {
      if (!Number.isSafeInteger(effect.remainingRounds) || effect.remainingRounds < 0) {
        throw new RangeError('Status duration must be a non-negative safe integer')
      }
      assertNonNegativeFinite(effect.value, 'Status value')
    }
  }
}

/** Applies one state-delta event to a versioned snapshot without mutating either input. */
export function reduceCombatEvent(
  snapshot: CombatStateSnapshot,
  event: CombatEvent,
): CombatStateSnapshot {
  if (snapshot.schemaVersion !== 1) throw new Error('Unsupported combat state snapshot schema')
  if (!Number.isSafeInteger(snapshot.level) || snapshot.level < 0 ||
    !Number.isSafeInteger(snapshot.round) || snapshot.round < 0) {
    throw new RangeError('Snapshot level and round must be non-negative safe integers')
  }
  assertUniqueUnits(snapshot.units)

  if (event.type === 'unit_state_changed') {
    const index = snapshot.units.findIndex(unit => unit.id === event.unitId)
    if (index < 0) throw new Error('Unknown combat unit: ' + event.unitId)
    const changes = event.changes
    if (changes.hp !== undefined) assertNonNegativeFinite(changes.hp, 'Unit HP')
    if (changes.mp !== undefined) assertNonNegativeFinite(changes.mp, 'Unit MP')
    if (changes.condition !== undefined && typeof changes.condition !== 'string') {
      throw new TypeError('Unit condition must be a string')
    }
    if (changes.defeated !== undefined && typeof changes.defeated !== 'boolean') {
      throw new TypeError('Unit defeated must be a boolean')
    }
    if (changes.statusEffects !== undefined) {
      for (const effect of changes.statusEffects) {
        if (!Number.isSafeInteger(effect.remainingRounds) || effect.remainingRounds < 0) {
          throw new RangeError('Status duration must be a non-negative safe integer')
        }
        assertNonNegativeFinite(effect.value, 'Status value')
      }
    }
    const units = snapshot.units.map((unit, unitIndex) => unitIndex === index
      ? {
          ...unit,
          ...changes,
          ...(changes.statusEffects === undefined ? {} : { statusEffects: changes.statusEffects.map(effect => ({ ...effect })) }),
        }
      : cloneUnit(unit))
    return { ...cloneSnapshot(snapshot), units }
  }

  if (event.type === 'combat_state_changed') {
    const changes = event.changes
    if (changes.level !== undefined && (!Number.isSafeInteger(changes.level) || changes.level < 0)) {
      throw new RangeError('Level must be a non-negative safe integer')
    }
    if (changes.round !== undefined && (!Number.isSafeInteger(changes.round) || changes.round < 0)) {
      throw new RangeError('Round must be a non-negative safe integer')
    }
    if (changes.buffs !== undefined) {
      for (const buff of changes.buffs) {
        assertNonNegativeFinite(buff.value, 'Buff value')
        if (buff.remainingRounds !== null &&
          (!Number.isSafeInteger(buff.remainingRounds) || buff.remainingRounds < 0)) {
          throw new RangeError('Buff duration must be null or a non-negative safe integer')
        }
      }
    }
    if (changes.cooldowns !== undefined) {
      for (const entries of Object.values(changes.cooldowns)) {
        for (const remaining of Object.values(entries)) {
          if (!Number.isSafeInteger(remaining) || remaining < 0) {
            throw new RangeError('Cooldown must be a non-negative safe integer')
          }
        }
      }
    }
    return {
      ...cloneSnapshot(snapshot),
      ...changes,
      ...(changes.buffs === undefined ? {} : { buffs: changes.buffs.map(buff => ({ ...buff })) }),
      ...(changes.cooldowns === undefined ? {} : {
        cooldowns: Object.fromEntries(Object.entries(changes.cooldowns).map(([unitId, entries]) => [
          unitId,
          Object.fromEntries(Object.entries(entries).map(([skillId, remaining]) => [skillId, remaining])),
        ])),
      }),
    }
  }

  return cloneSnapshot(snapshot)
}

/** Reduces a journal in its recorded order. Semantic-only events leave state unchanged. */
export function reconstructCombatState(
  initial: CombatStateSnapshot,
  events: readonly { readonly event: CombatEvent }[],
): CombatStateSnapshot {
  return events.reduce((state, envelope) => reduceCombatEvent(state, envelope.event), cloneSnapshot(initial))
}
