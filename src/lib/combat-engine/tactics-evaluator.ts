// ─────────────────────────────────────────────────────────────────────────────
// IRONHOLD — Evaluador de tácticas
// lib/combat-engine/tactics-evaluator.ts
// ─────────────────────────────────────────────────────────────────────────────

import { randomIntInclusive, type RandomSource } from '@/engine/core/random/random-source'

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
  manaShield?: boolean
  skillCooldowns?: Record<string, Record<number, number>>  // heroId -> { skillId -> remainingRounds }
  factionBonuses?: { atk: number; def: number; combustion: boolean; darknessHeal: boolean }
  buffs: BuffEntry[]
}

// ─── POSITION PRIORITY TABLE ──────────────────────────────────────────────

export function getPositionPriority(attackerPosition: string, isRanged: boolean): string[] {
  const base: Record<string, string[][]> = {
    front: [
      ['front', 'center', 'rear', 'left_flank', 'right_flank'],
    ],
    left_flank: [
      ['left_flank', 'right_flank', 'front', 'center', 'rear'],
    ],
    right_flank: [
      ['left_flank', 'right_flank', 'front', 'center', 'rear'],
    ],
    center: [
      ['center', 'rear', 'front', 'left_flank', 'right_flank'],
      ['front', 'center', 'rear', 'left_flank', 'right_flank'],
    ],
    rear: [
      ['rear', 'center', 'front', 'left_flank', 'right_flank'],
      ['front', 'center', 'rear', 'left_flank', 'right_flank'],
    ],
  }

  const variants = base[attackerPosition]
  if (!variants) return ['front', 'center', 'rear', 'left_flank', 'right_flank']

  // Index 0 = ranged/magic, index 1 = melee/CC
  let idx: number
  if (attackerPosition === 'center' || attackerPosition === 'rear') {
    idx = isRanged ? 0 : 1
  } else {
    idx = 0
  }
  return variants[idx] ?? variants[0]
}

function isRangedAttack(tags?: string[]): boolean {
  if (!tags || tags.length === 0) return false
  return tags.includes('magic') || tags.includes('ranged')
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
  const heroHpPct = (hero.hp / hero.maxHp) * 100
  const heroMpPct = (hero.mp / hero.maxMp) * 100

  const aliveEnemies = enemies.filter(e => e.hp > 0)

  switch (cond.type) {
    case 'always':
      return true

    case 'hp_self_lt':
      return heroHpPct < (cond.value ?? 30)

    case 'hp_self_gt':
      return heroHpPct > (cond.value ?? 70)

    case 'hp_enemy_lt': {
      const weakest = getWeakest(aliveEnemies)
      if (!weakest) return false
      return (weakest.hp / weakest.maxHp) * 100 < (cond.value ?? 25)
    }

    case 'hp_ally_lt': {
      const threshold = cond.value ?? 50
      if (heroHpPct < threshold) return true
      return allies.some(a => (a.hp / a.maxHp) * 100 < threshold)
    }

    case 'round_gt':
      return round > (cond.value ?? 3)

    case 'mana_lt':
      return heroMpPct < (cond.value ?? 20)

    case 'ally_down':
      return allies.some(a => a.hp <= 0)

    case 'damaged_this_round':
      return state.damagedThisRound

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
  const aliveEnemies = state.enemies.filter(e => e.hp > 0)
  const aliveAllies = state.allies.filter(a => a.hp > 0)

  if (action.targetType === 'most_injured_ally') {
    return getMostInjured([state.hero, ...aliveAllies])
  }

  if (aliveEnemies.length === 0) return null

  // Prioritize traps — heroes target them first
  const traps = aliveEnemies.filter(e => e.trap)
  if (traps.length > 0) return pickByType(traps, action.targetType, random)

  // If targetPos is not 'auto', use exact position filter (legacy behavior)
  if (action.targetPos !== 'auto') {
    const posFiltered = aliveEnemies.filter(e => e.position === action.targetPos)
    const pool = posFiltered.length > 0 ? posFiltered : aliveEnemies
    return pickByType(pool, action.targetType, random)
  }

  // Use position priority when targetPos is 'auto'
  const pos = actorPosition ?? state.hero.position
  const ranged = isRangedAttack(skillTags)
  const priority = getPositionPriority(pos, ranged)

  for (const p of priority) {
    const matches = aliveEnemies.filter(e => e.position === p)
    if (matches.length > 0) {
      return pickByType(matches, action.targetType, random)
    }
  }

  // Fallback: any alive enemy
  return pickByType(aliveEnemies, action.targetType, random)
}

function pickByType(pool: CombatUnit[], targetType: string, random: RandomSource = { next: () => Math.random() }): CombatUnit | null {
  switch (targetType) {
    case 'weakest':
    case 'auto':
      return getWeakest(pool)
    case 'strongest':
      return getStrongest(pool)
    case 'random':
      return pool[randomIntInclusive(random, 0, pool.length - 1)] ?? null
    default:
      return getWeakest(pool)
  }
}

// ─── UTILIDADES ──────────────────────────────────────────────────────────────

const getWeakest = (units: CombatUnit[]): CombatUnit | null =>
  units.reduce<CombatUnit | null>(
    (min, u) => !min || u.hp < min.hp ? u : min,
    null
  )

const getStrongest = (units: CombatUnit[]): CombatUnit | null =>
  units.reduce<CombatUnit | null>(
    (max, u) => !max || u.hp > max.hp ? u : max,
    null
  )

const getMostInjured = (units: CombatUnit[]): CombatUnit | null =>
  units.reduce<CombatUnit | null>((min, u) => {
    if (u.hp >= u.maxHp) return min
    if (!min) return u
    const uPct = u.hp / u.maxHp
    const minPct = min.hp / min.maxHp
    return uPct < minPct ? u : min
  }, null)

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
  const actors: TurnActor[] = []

  for (const hero of heroes) {
    if (hero.hp > 0) {
      const base = hero.attrs ? calcInitiativeBase(hero.attrs as any) : 12
      actors.push({ unit: hero, initiative: rollInitiative(base, random), isHero: true, attrs: hero.attrs })
    }
  }

  for (const enemy of enemies) {
    if (enemy.hp > 0 && !enemy.trap) {
      actors.push({ unit: enemy, initiative: rollInitiative(10, random), isHero: false })
    }
  }

  return actors.sort((a, b) => b.initiative - a.initiative)
}

import { rollInitiative, calcInitiativeBase, DamageType } from './formulas'
