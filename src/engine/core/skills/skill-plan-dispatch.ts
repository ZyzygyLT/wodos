import type { SkillExecutionPlan } from '../skills/skill-execution'

export interface SkillExecutionPlanHandlers<TUnit, TResult> {
  readonly heal: (target: TUnit | null, healPct: number) => TResult
  readonly party_buff: (buff: 'atk' | 'def', bonus: number) => TResult
  readonly area_attack: (targets: readonly TUnit[], armorPenetration: boolean, critical: boolean) => TResult
  readonly single_attack: (target: TUnit | null, armorPenetration: boolean, critical: boolean) => TResult
}

/**
 * Dispatches a resolved skill plan to the game-specific effect handlers.
 * The engine owns the exhaustive plan-kind routing; handlers retain all
 * mutation, damage, healing, status-effect and reporting behavior.
 */
export function dispatchSkillExecutionPlan<TUnit, TResult>(
  plan: SkillExecutionPlan<TUnit>,
  handlers: SkillExecutionPlanHandlers<TUnit, TResult>,
): TResult {
  switch (plan.kind) {
    case 'heal':
      return handlers.heal(plan.target, plan.healPct)
    case 'party_buff':
      return handlers.party_buff(plan.buff, plan.bonus)
    case 'area_attack':
      return handlers.area_attack(plan.targets, plan.armorPenetration, plan.critical)
    case 'single_attack':
      return handlers.single_attack(plan.target, plan.armorPenetration, plan.critical)
    default: {
      const exhaustive: never = plan
      return exhaustive
    }
  }
}
