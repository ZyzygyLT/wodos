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

export interface TacticAction {
  skillId: number
  itemId?: number
  targetPos: TargetPosition
  targetType: TargetType
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

  for (const rule of sorted) {
    if (evalCondition(rule.condition, state)) {
      return rule.action
    }
  }

  return { skillId: fallbackSkillId, targetPos: 'auto', targetType: 'weakest' }
}

export const evalCondition = (
  cond: TacticCondition,
  state: CombatState
): boolean => {
  const { hero, enemies, allies, round } = state
  const heroHpPct = getResourcePercent(hero.hp, hero.maxHp)
  const heroMpPct = getResourcePercent(hero.mp, hero.maxMp)
  const aliveEnemies = enemies.filter(e => Number.isFinite(e.hp) && e.hp > 0)

  const threshold = (fallback: number) =>
    typeof cond.value === 'number' && Number.isFinite(cond.value) ? cond.value : fallback

  switch (cond.type) {
    case 'always':
      return true

    case 'hp_self_lt':
      return heroHpPct !== null && heroHpPct < threshold(30)

    case 'hp_self_gt':
      return heroHpPct !== null && heroHpPct > threshold(70)

    case 'hp_enemy_lt': {
      const weakest = getWeakest(aliveEnemies)
      if (!weakest) return false
      const hpPct = getResourcePercent(weakest.hp, weakest.maxHp)
      return hpPct !== null && hpPct < threshold(25)
    }

    case 'hp_ally_lt': {
      const limit = threshold(50)
      if (heroHpPct !== null && heroHpPct < limit) return true
      return allies.some(ally => {
        const hpPct = getResourcePercent(ally.hp, ally.maxHp)
        return hpPct !== null && hpPct < limit
      })
    }

    case 'round_gt':
      return Number.isFinite(round) && round > threshold(3)

    case 'mana_lt':
      return heroMpPct !== null && heroMpPct < threshold(20)

    case 'ally_down':
      return allies.some(a => Number.isFinite(a.hp) && a.hp <= 0)

    case 'damaged_this_round':
      return state.damagedThisRound === true

    default:
      return false
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
    getEnemyInitiativeBase: () => 10,
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
