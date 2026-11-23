export interface CombatTurnActor {
  unit: { id: string }
  initiative: number
  isHero: boolean
}

export interface CombatTurnExecution<TActor extends CombatTurnActor, TUnit> {
  actors: readonly TActor[]
  resolveUnit: (actor: TActor) => TUnit | undefined
  isAlive: (unit: TUnit) => boolean
  shouldStop: () => boolean
  isDisabled?: (unit: TUnit) => boolean
  onDisabled?: (unit: TUnit, actor: TActor, actorIndex: number) => void
  execute: (unit: TUnit, actor: TActor, actorIndex: number, totalActors: number) => void
}

export interface CombatTurnExecutionResult {
  totalActors: number
  visitedActors: number
  executedActors: number
  skippedActors: number
  stoppedEarly: boolean
}

/**
 * Executes an already ordered initiative queue.
 * Domain-specific actor resolution, stop conditions and turn actions remain injected by the caller.
 * Actor indices intentionally refer to the original queue, including skipped actors.
 */
export function executeCombatTurnQueue<TActor extends CombatTurnActor, TUnit>(
  input: CombatTurnExecution<TActor, TUnit>,
): CombatTurnExecutionResult {
  const totalActors = input.actors.length
  let visitedActors = 0
  let executedActors = 0
  let skippedActors = 0
  let stoppedEarly = false

  for (let actorIndex = 0; actorIndex < totalActors; actorIndex++) {
    if (input.shouldStop()) {
      stoppedEarly = true
      break
    }

    const actor = input.actors[actorIndex]
    visitedActors++
    const unit = input.resolveUnit(actor)
    if (unit === undefined || !input.isAlive(unit)) {
      skippedActors++
      continue
    }

    if (input.isDisabled?.(unit)) {
      skippedActors++
      input.onDisabled?.(unit, actor, actorIndex)
      continue
    }

    input.execute(unit, actor, actorIndex, totalActors)
    executedActors++
  }

  return { totalActors, visitedActors, executedActors, skippedActors, stoppedEarly }
}
