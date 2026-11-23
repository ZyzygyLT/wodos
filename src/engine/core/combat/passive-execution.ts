export interface PassiveExecutionCommand {
  readonly trigger: 'on_damage' | 'on_death' | 'on_round_start'
  readonly effectType: 'damage' | 'heal' | 'buff'
  readonly targetType: 'attacker' | 'all_heroes' | 'all_enemies' | 'self'
  readonly value: number
  readonly sourceId: string
  readonly sourceName: string
  readonly damageType?: string
  readonly buffType?: 'atk' | 'def'
}

export interface PassiveExecutionContext {
  readonly sourceId: string
  readonly attackerId?: string
  readonly heroIds: readonly string[]
  readonly enemyIds: readonly string[]
}

export interface PassiveExecutionPlan {
  readonly command: PassiveExecutionCommand
  readonly targetIds: readonly string[]
}

/**
 * Resolves legacy passive target semantics into stable unit IDs.
 * The planner is pure: it does not mutate units, apply effects, or filter
 * defeated units. Individual legacy handlers retain their own alive/dead rules.
 */
export function planPassiveExecution(
  command: PassiveExecutionCommand,
  context: PassiveExecutionContext,
): PassiveExecutionPlan {
  let targetIds: readonly string[]
  switch (command.targetType) {
    case 'self':
      targetIds = [context.sourceId]
      break
    case 'attacker':
      targetIds = context.attackerId ? [context.attackerId] : []
      break
    case 'all_heroes':
      targetIds = context.heroIds
      break
    case 'all_enemies':
      targetIds = context.enemyIds
      break
    default:
      targetIds = []
  }

  // Legacy buff passives do not support targeting the attacker.
  if (command.effectType === 'buff' && command.targetType === 'attacker') {
    targetIds = []
  }

  return { command, targetIds: [...targetIds] }
}
