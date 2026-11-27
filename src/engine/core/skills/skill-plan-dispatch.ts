import type { SkillExecutionPlan } from '../skills/skill-execution'

export interface SkillExecutionPlanHandlers<TUnit, TResult> {
  readonly heal: (target: TUnit | null, healPct: number) => TResult
  readonly group_heal?: (targets: readonly TUnit[], healPct: number) => TResult
  readonly heal_over_time?: (target: TUnit | null, healPct: number, ticks: number) => TResult
  readonly party_buff: (buff: 'atk' | 'def', bonus: number) => TResult
  readonly self_buff: (buffs: readonly { readonly buff: 'atk' | 'def'; readonly bonus: number }[]) => TResult
  readonly area_attack: (targets: readonly TUnit[], armorPenetration: boolean, critical: boolean) => TResult
  readonly single_attack: (target: TUnit | null, armorPenetration: boolean, critical: boolean) => TResult
  readonly unsupported: (effect: string) => TResult
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
    case 'group_heal':
      return handlers.group_heal?.(plan.targets, plan.healPct) ?? handlers.unsupported('group_heal')
    case 'heal_over_time':
      return handlers.heal_over_time?.(plan.target, plan.healPct, plan.ticks) ?? handlers.unsupported('heal_over_time')
    case 'party_buff':
      return handlers.party_buff(plan.buff, plan.bonus)
    case 'self_buff':
      return handlers.self_buff(plan.buffs)
    case 'area_attack':
      return handlers.area_attack(plan.targets, plan.armorPenetration, plan.critical)
    case 'single_attack':
      return handlers.single_attack(plan.target, plan.armorPenetration, plan.critical)
    case 'unsupported':
      return handlers.unsupported(plan.effect)
    default: {
      const exhaustive: never = plan
      return exhaustive
    }
  }
}
