import { randomIntInclusive, type RandomSource } from '../random/random-source'

export interface InitiativeActorLike {
  initiative: number
}

export interface InitiativeQueueInput<THero, TEnemy, TActor extends InitiativeActorLike> {
  heroes: readonly THero[]
  enemies: readonly TEnemy[]
  isHeroAlive: (hero: THero) => boolean
  isEnemyAlive: (enemy: TEnemy) => boolean
  isEnemyExcluded: (enemy: TEnemy) => boolean
  getHeroInitiativeBase: (hero: THero) => number
  getEnemyInitiativeBase: (enemy: TEnemy) => number
  rollInitiative: (base: number) => number
  createHeroActor: (hero: THero, initiative: number) => TActor
  createEnemyActor: (enemy: TEnemy, initiative: number) => TActor
}

/** Adds the legacy inclusive random bonus of 0..19 to an initiative base. */
export function rollCombatInitiative(
  base: number,
  random: RandomSource = { next: () => Math.random() }
): number {
  return base + randomIntInclusive(random, 0, 19)
}

/** Stable descending sort; actors with equal initiative retain insertion order. */
export function orderInitiativeQueue<T extends InitiativeActorLike>(actors: readonly T[]): T[] {
  return [...actors].sort((a, b) => b.initiative - a.initiative)
}

/**
 * Builds a generic initiative queue. Domain-specific alive/exclusion rules,
 * base-stat calculation and actor shape are supplied by the caller.
 * Random rolls are consumed in hero input order, then enemy input order.
 */
export function buildInitiativeQueue<THero, TEnemy, TActor extends InitiativeActorLike>(
  input: InitiativeQueueInput<THero, TEnemy, TActor>
): TActor[] {
  const actors: TActor[] = []

  for (const hero of input.heroes) {
    if (!input.isHeroAlive(hero)) continue
    actors.push(input.createHeroActor(hero, input.rollInitiative(input.getHeroInitiativeBase(hero))))
  }

  for (const enemy of input.enemies) {
    if (!input.isEnemyAlive(enemy) || input.isEnemyExcluded(enemy)) continue
    actors.push(input.createEnemyActor(enemy, input.rollInitiative(input.getEnemyInitiativeBase(enemy))))
  }

  return orderInitiativeQueue(actors)
}
