export interface HeroTurnPipelineInput<TAction, TResult> {
  readonly selectAction: () => TAction
  readonly recordSelection: (action: TAction) => void
  readonly applyCooldownOverride: (action: TAction) => TAction
  readonly applyBuffOverride: (action: TAction) => TAction
  readonly execute: (action: TAction) => TResult | null
  readonly afterSuccessfulExecution: (action: TAction, result: TResult) => void
}

/**
 * Coordinates the hero-turn stages while leaving tactical policy, logging,
 * state mutation and action resolution in injected application callbacks.
 * The post-action hook runs only when the executor returns a non-null result.
 */
export function executeHeroTurnPipeline<TAction, TResult>(
  input: HeroTurnPipelineInput<TAction, TResult>
): TResult | null {
  const selected = input.selectAction()
  input.recordSelection(selected)
  const withCooldown = input.applyCooldownOverride(selected)
  const finalAction = input.applyBuffOverride(withCooldown)
  const result = input.execute(finalAction)
  if (result !== null) input.afterSuccessfulExecution(finalAction, result)
  return result
}

export interface EnemyTurnPipelineInput<TDefinition, TUnit, TResult> {
  readonly isAlive: (unit: TUnit) => boolean
  readonly resolveDefinition: (unit: TUnit) => TDefinition | undefined
  readonly execute: (definition: TDefinition, unit: TUnit) => TResult | null
}

/**
 * Resolves the enemy's domain definition and guards dead/unmapped actors before
 * invoking the injected Wodos action executor.
 */
export function executeEnemyTurnPipeline<TDefinition, TUnit, TResult>(
  input: EnemyTurnPipelineInput<TDefinition, TUnit, TResult>,
  unit: TUnit
): TResult | null {
  if (!input.isAlive(unit)) return null
  const definition = input.resolveDefinition(unit)
  if (definition === undefined) return null
  return input.execute(definition, unit)
}
