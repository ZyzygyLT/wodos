import {
  selectCombatTarget,
  type TargetPosition,
  type TargetType,
  type TargetableUnit,
} from './target-selection'

export interface SkillExecutionDefinition {
  readonly skillId: number
  readonly name?: string
  readonly effect?: string
  readonly multiplier?: number
  readonly rank?: number
  readonly healPct?: number
  readonly tags?: readonly string[]
}

export interface SkillExecutionAction {
  readonly targetPos: TargetPosition
  readonly targetType: TargetType
}

export interface SkillExecutionInput<T extends TargetableUnit> {
  readonly skill: SkillExecutionDefinition
  readonly actor: T
  /** Other living allies; the actor is considered separately. */
  readonly allies: readonly T[]
  readonly enemies: readonly T[]
  readonly action: SkillExecutionAction
}

export type SkillExecutionPlan<T> =
  | { readonly kind: 'heal'; readonly target: T | null; readonly healPct: number }
  | { readonly kind: 'party_buff'; readonly buff: 'atk' | 'def'; readonly bonus: number }
  | { readonly kind: 'area_attack'; readonly targets: readonly T[]; readonly armorPenetration: boolean; readonly critical: boolean }
  | { readonly kind: 'single_attack'; readonly target: T | null; readonly armorPenetration: boolean; readonly critical: boolean }

/**
 * Resolves the action shape and targets for a skill without mutating combat state.
 * Damage, healing, buff application, resource mutation, cooldowns and reporting
 * remain the responsibility of the calling combat application.
 */
export function resolveSkillExecution<T extends TargetableUnit>(
  input: SkillExecutionInput<T>,
): SkillExecutionPlan<T> {
  const { skill, actor, allies, enemies, action } = input
  const effect = skill.effect ?? 'attack'
  const rank = skill.rank ?? 1

  if (effect === 'heal' && skill.healPct) {
    const injured = [actor, ...allies].filter(unit => unit.hp > 0 && unit.hp < unit.maxHp)
    const target = injured.reduce<T | null>((best, unit) => {
      if (!best || unit.hp / unit.maxHp < best.hp / best.maxHp) return unit
      return best
    }, null)
    return { kind: 'heal', target, healPct: skill.healPct }
  }

  if (effect === 'party_attack_up' || effect === 'defense_up') {
    const isAttack = effect === 'party_attack_up'
    const bonus = Math.round((skill.multiplier || (isAttack ? 1.5 : 1)) * 10) + rank * 2
    return { kind: 'party_buff', buff: isAttack ? 'atk' : 'def', bonus }
  }

  if (effect === 'aoe_attack') {
    return {
      kind: 'area_attack',
      targets: enemies.filter(unit => unit.hp > 0),
      armorPenetration: false,
      critical: false,
    }
  }

  const selection = selectCombatTarget({
    actor,
    allies,
    enemies,
    targetPosition: action.targetPos,
    targetType: action.targetType,
    skillTags: skill.tags,
  })

  return {
    kind: 'single_attack',
    target: selection.target,
    armorPenetration: effect === 'armor_penetration',
    critical: effect === 'critical_attack',
  }
}
