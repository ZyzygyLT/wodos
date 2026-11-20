import type { RandomSource } from '../random/random-source'
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
  readonly healTarget?: 'self' | 'most_injured_ally'
  readonly tags?: readonly string[]
}

export interface SkillExecutionAction {
  readonly targetPos: TargetPosition
  readonly targetType: TargetType
  readonly globalTargeting?: boolean
}

export interface SkillExecutionInput<T extends TargetableUnit> {
  readonly skill: SkillExecutionDefinition
  readonly actor: T
  /** Other living allies; the actor is considered separately. */
  readonly allies: readonly T[]
  readonly enemies: readonly T[]
  readonly action: SkillExecutionAction
  readonly random?: RandomSource
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
  const { skill, actor, allies, enemies, action, random } = input
  const effect = skill.effect ?? 'attack'
  const rank = Number.isFinite(skill.rank) && (skill.rank ?? 0) > 0 ? skill.rank! : 1

  if (effect === 'heal') {
    const healPct = Number.isFinite(skill.healPct) ? Math.max(0, skill.healPct!) : 0
    const candidates = (skill.healTarget === 'self' ? [actor] : [actor, ...allies]).filter(unit =>
      Number.isFinite(unit.hp) && Number.isFinite(unit.maxHp) &&
      unit.hp > 0 && unit.maxHp > 0 && unit.hp < unit.maxHp
    )
    const target = healPct > 0
      ? candidates.reduce<T | null>((best, unit) => {
          if (!best || unit.hp / unit.maxHp < best.hp / best.maxHp) return unit
          return best
        }, null)
      : null
    return { kind: 'heal', target, healPct }
  }

  if (effect === 'party_attack_up' || effect === 'defense_up') {
    const isAttack = effect === 'party_attack_up'
    const fallbackMultiplier = isAttack ? 1.5 : 1
    const multiplier = Number.isFinite(skill.multiplier) && (skill.multiplier ?? 0) > 0
      ? skill.multiplier!
      : fallbackMultiplier
    const bonus = Math.round(multiplier * 10) + rank * 2
    return { kind: 'party_buff', buff: isAttack ? 'atk' : 'def', bonus }
  }

  if (effect === 'aoe_attack') {
    return {
      kind: 'area_attack',
      targets: enemies.filter(unit => Number.isFinite(unit.hp) && unit.hp > 0),
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
    random,
    globalTargeting: action.globalTargeting,
  })

  return {
    kind: 'single_attack',
    target: selection.target,
    armorPenetration: effect === 'armor_penetration',
    critical: effect === 'critical_attack',
  }
}
