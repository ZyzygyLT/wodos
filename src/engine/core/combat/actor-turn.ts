export interface CombatActorTurn {
  readonly isHero: boolean
}

export interface CombatActorTurnInput<TActor extends CombatActorTurn, TUnit, TResult> {
  readonly actor: TActor
  readonly unit: TUnit
  readonly actorIndex: number
  readonly totalActors: number
  readonly executeHero: (unit: TUnit, actor: TActor, actorIndex: number, totalActors: number) => TResult
  readonly executeEnemy: (unit: TUnit, actor: TActor, actorIndex: number, totalActors: number) => TResult
}

/**
 * Routes a scheduled actor to the appropriate side-specific action executor.
 * The engine owns only this dispatch contract; game rules, state mutation,
 * logging and reporting remain inside the injected executors.
 */
export function dispatchCombatActorTurn<TActor extends CombatActorTurn, TUnit, TResult>(
  input: CombatActorTurnInput<TActor, TUnit, TResult>
): TResult {
  const { actor, unit, actorIndex, totalActors } = input
  return actor.isHero
    ? input.executeHero(unit, actor, actorIndex, totalActors)
    : input.executeEnemy(unit, actor, actorIndex, totalActors)
}
