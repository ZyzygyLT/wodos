// ─────────────────────────────────────────────────────────────────────────────
// IRONHOLD — Evaluador de tácticas
// lib/combat-engine/tactics-evaluator.ts
// ─────────────────────────────────────────────────────────────────────────────

import type { RandomSource } from '@/engine/core/random/random-source'
import { buildInitiativeQueue } from '@/engine/core/combat/initiative'
import { getTargetPositionPriority, selectCombatTarget } from '@/engine/core/skills/target-selection'

// ─── TIPOS ───────────────────────────────────────────────────────────────────

export type ConditionType =
  | 'always'
  | 'hp_self_lt'
  | 'hp_self_gt'
  | 'hp_enemy_lt'
  | 'hp_ally_lt'
  | 'round_gt'
  | 'mana_lt'
  | 'ally_down'
  | 'damaged_this_round'

export type TargetPosition = 'front' | 'center' | 'rear' | 'left_flank' | 'right_flank' | 'auto'
export type TargetType = 'weakest' | 'strongest' | 'most_injured_ally' | 'random' | 'auto' | 'self'

export interface TacticCondition {
  type: ConditionType
  value?: number
}

export interface TacticRuleEvaluation {
  priority: number
  condition: TacticCondition
  matched: boolean
  reason?: string
}

export interface TacticAction {
  skillId: number
  itemId?: number
  targetPos: TargetPosition
  targetType: TargetType
  /** Internal reason when a tactical override replaces the selected skill. */
  fallbackReason?: 'cooldown' | 'buff_active'
  selectedSkillId?: number
  /** Priority and trigger condition of the first rule matched by the evaluator. */
  matchedRulePriority?: number
  matchedCondition?: TacticCondition
  /** Rules actually evaluated, in priority order, through the first match. */
  ruleEvaluationTrace?: TacticRuleEvaluation[]
}

export interface RoundRule {
  priority: number
  condition: TacticCondition
  action: TacticAction
}

export interface CombatUnit {
  id: string
  name: string
  icon?: string
  level?: number
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  isHero: boolean
  isAlly: boolean
  trap?: boolean
  position: string
  condition: string
  attrs?: Record<string, number>
  def?: number
  armorName?: string
  attackSkillName?: string
  attackSkillIcon?: string
  defenseValues?: Record<string, number>
  defenseSkillNames?: Record<string, string>
  defenseEffects?: Record<string, string>
  statusEffects?: StatusEffect[]
  passiveEffects?: PassiveEffect[]
  faction?: string
  thornsPct?: number
  vampirePct?: number
  counterPct?: number
  resistances?: Partial<Record<DamageType, number>>
}

export type StatusEffectType = 'poison' | 'burn' | 'bleed' | 'stun' | 'freeze' | 'atk_up' | 'def_up' | 'shield' | 'regen'

export interface StatusEffect {
  type: StatusEffectType
  remainingRounds: number
  value: number
  source: string
  sourceName: string
}

export interface PassiveEffect {
  trigger: 'on_damage' | 'on_death' | 'on_round_start'
  effectType: 'damage' | 'heal' | 'buff'
  targetType: 'attacker' | 'all_heroes' | 'all_enemies' | 'self'
  value: number | { base: number; coeff?: number; attrScale?: string }
  damageType?: string
  sourceName: string
  buffType?: 'atk' | 'def'
}

export interface BuffEntry {
  type: 'atk' | 'def'
  value: number
  remainingRounds: number | null  // null = permanent
  sourceName: string
  icon?: string
  side: 'hero' | 'enemy'
}

export interface CombatState {
  hero: CombatUnit
  allies: CombatUnit[]
  enemies: CombatUnit[]
  round: number
  damagedThisRound: boolean
  groupAtkBonus: number
  groupDefBonus: number
  /** Stable hero-side bonuses retained when temporary buffs are recalculated. */
  baseGroupAtkBonus?: number
  baseGroupDefBonus?: number
  manaShield?: boolean
  skillCooldowns?: Record<string, Record<number, number>>  // heroId -> { skillId -> remainingRounds }
  factionBonuses?: { atk: number; def: number; combustion: boolean; darknessHeal: boolean }
  buffs: BuffEntry[]
}

// ─── POSITION PRIORITY TABLE ──────────────────────────────────────────────

export function getPositionPriority(attackerPosition: string, isRanged: boolean): string[] {
  return getTargetPositionPriority(attackerPosition, isRanged)
}

// ─── EVALUADOR ───────────────────────────────────────────────────────────────

export const evalTactics = (
  rules: RoundRule[],
  state: CombatState,
  fallbackSkillId: number = 1
): TacticAction => {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority)
  const ruleEvaluationTrace: TacticRuleEvaluation[] = []

  for (const rule of sorted) {
    const evaluation = evaluateConditionWithReason(rule.condition, state)
    ruleEvaluationTrace.push({
      priority: rule.priority,
      condition: { ...rule.condition },
      matched: evaluation.matched,
      ...(evaluation.reason ? { reason: evaluation.reason } : {}),
    })
    if (evaluation.matched) {
      return {
        ...rule.action,
        matchedRulePriority: rule.priority,
        matchedCondition: { ...rule.condition },
        ruleEvaluationTrace,
      }
    }
  }

  return {
    skillId: fallbackSkillId,
    targetPos: 'auto',
    targetType: 'weakest',
    ruleEvaluationTrace,
  }
}

export const evalCondition = (
  cond: TacticCondition,
  state: CombatState
): boolean => evaluateConditionWithReason(cond, state).matched

function evaluateConditionWithReason(
  cond: TacticCondition,
  state: CombatState
): { matched: boolean; reason?: string } {
  const { hero, enemies, allies, round } = state
  const heroHpPct = getResourcePercent(hero.hp, hero.maxHp)
  const heroMpPct = getResourcePercent(hero.mp, hero.maxMp)
  const aliveEnemies = enemies.filter(e => Number.isFinite(e.hp) && e.hp > 0)
  const threshold = (fallback: number) =>
    typeof cond.value === 'number' && Number.isFinite(cond.value) ? cond.value : fallback
  const percent = (value: number) => `${value.toFixed(1)}%`

  switch (cond.type) {
    case 'always':
      return { matched: true }

    case 'hp_self_lt': {
      const limit = threshold(30)
      if (heroHpPct === null) return { matched: false, reason: 'HP máximo propio no válido' }
      return heroHpPct < limit
        ? { matched: true }
        : { matched: false, reason: `HP propio ${percent(heroHpPct)} no es inferior a ${limit}%` }
    }

    case 'hp_self_gt': {
      const limit = threshold(70)
      if (heroHpPct === null) return { matched: false, reason: 'HP máximo propio no válido' }
      return heroHpPct > limit
        ? { matched: true }
        : { matched: false, reason: `HP propio ${percent(heroHpPct)} no supera ${limit}%` }
    }

    case 'hp_enemy_lt': {
      const weakest = getWeakest(aliveEnemies)
      if (!weakest) return { matched: false, reason: 'No hay enemigos vivos para comprobar su HP' }
      const hpPct = getResourcePercent(weakest.hp, weakest.maxHp)
      if (hpPct === null) return { matched: false, reason: `HP máximo de ${weakest.name} no válido` }
      const limit = threshold(25)
      return hpPct < limit
        ? { matched: true }
        : { matched: false, reason: `El enemigo más débil (${weakest.name}) tiene ${percent(hpPct)} de HP; no está por debajo de ${limit}%` }
    }

    case 'hp_ally_lt': {
      const limit = threshold(50)
      const candidates = [hero, ...allies]
      const percentages = candidates
        .map(unit => ({ name: unit.name, hp: getResourcePercent(unit.hp, unit.maxHp) }))
        .filter((entry): entry is { name: string; hp: number } => entry.hp !== null)
      if (percentages.some(entry => entry.hp < limit)) return { matched: true }
      if (percentages.length === 0) return { matched: false, reason: 'No hay valores de HP válidos en el grupo' }
      const lowest = percentages.reduce((min, entry) => entry.hp < min.hp ? entry : min)
      return {
        matched: false,
        reason: `El miembro más herido (${lowest.name}) tiene ${percent(lowest.hp)} de HP; el umbral es ${limit}%`,
      }
    }

    case 'round_gt': {
      const limit = threshold(3)
      if (!Number.isFinite(round)) return { matched: false, reason: 'Número de ronda no válido' }
      return round > limit
        ? { matched: true }
        : { matched: false, reason: `Ronda actual ${round}; debe ser superior a ${limit}` }
    }

    case 'mana_lt': {
      const limit = threshold(20)
      if (heroMpPct === null) return { matched: false, reason: 'Maná máximo propio no válido' }
      return heroMpPct < limit
        ? { matched: true }
        : { matched: false, reason: `Maná propio ${percent(heroMpPct)} no está por debajo de ${limit}%` }
    }

    case 'ally_down':
      return allies.some(a => Number.isFinite(a.hp) && a.hp <= 0)
        ? { matched: true }
        : { matched: false, reason: 'Ningún aliado está derrotado' }

    case 'damaged_this_round':
      return state.damagedThisRound
        ? { matched: true }
        : { matched: false, reason: 'No recibió daño durante esta ronda' }

    default:
      return { matched: false, reason: 'Tipo de condición desconocido' }
  }
}

// ─── SELECCIÓN DE OBJETIVO ───────────────────────────────────────────────────

export const resolveTarget = (
  action: TacticAction,
  state: CombatState,
  actorPosition?: string,
  skillTags?: string[],
  random: RandomSource = { next: () => Math.random() }
): CombatUnit | null => {
  const actor = actorPosition
    ? { ...state.hero, position: actorPosition }
    : state.hero
  return selectCombatTarget({
    actor,
    allies: state.allies,
    enemies: state.enemies,
    targetPosition: action.targetPos,
    targetType: action.targetType,
    skillTags,
    random,
  }).target
}

// ─── UTILIDADES ──────────────────────────────────────────────────────────────

/** Returns a bounded resource percentage, or null when persisted combat data is invalid. */
const getResourcePercent = (current: number, maximum: number): number | null => {
  if (!Number.isFinite(current) || !Number.isFinite(maximum) || maximum <= 0) return null
  return Math.max(0, Math.min(100, (current / maximum) * 100))
}

const getWeakest = (units: CombatUnit[]): CombatUnit | null =>
  units.reduce<CombatUnit | null>(
    (min, u) => !min || u.hp < min.hp ? u : min,
    null
  )

// ─── QUEUE DE TURNOS ─────────────────────────────────────────────────────────

export interface TurnActor {
  unit: CombatUnit
  initiative: number
  isHero: boolean
  attrs?: Record<string, number>
}

export const buildTurnQueue = (
  heroes: (CombatUnit & { attrs?: Record<string, number> })[],
  enemies: CombatUnit[],
  random: RandomSource = { next: () => Math.random() }
): TurnActor[] => {
  return buildInitiativeQueue({
    heroes,
    enemies,
    isHeroAlive: hero => hero.hp > 0,
    isEnemyAlive: enemy => enemy.hp > 0,
    isEnemyExcluded: enemy => !!enemy.trap,
    getHeroInitiativeBase: hero => hero.attrs ? calcInitiativeBase(hero.attrs as any) : 12,
    getEnemyInitiativeBase: enemy => enemy.attrs ? calcInitiativeBase(enemy.attrs as any) : 10,
    rollInitiative: base => rollInitiative(base, random),
    createHeroActor: (hero, initiative): TurnActor => ({
      unit: hero,
      initiative,
      isHero: true,
      attrs: hero.attrs,
    }),
    createEnemyActor: (enemy, initiative): TurnActor => ({
      unit: enemy,
      initiative,
      isHero: false,
    }),
  })
}

import { rollInitiative, calcInitiativeBase, type DamageType } from './formulas'
