// ─────────────────────────────────────────────────────────────────────────────
// IRONHOLD — Motor de dungeon (multi-héroe)
// lib/combat-engine/dungeon-runner.ts
// ─────────────────────────────────────────────────────────────────────────────

import {
  calcDefenseBase,
  calcActualDamage, calcHeal,
  getCondition, calcReward, CRIT_MULTIPLIER, evaluateFormula,
  applyDiceMultiplier, SkillFormula, DamageType,
} from './formulas'

import {
  evalTactics, buildTurnQueue,
  CombatState, CombatUnit, RoundRule, TacticAction, TacticCondition, TacticRuleEvaluation, StatusEffect,
  BuffEntry, PassiveEffect,
} from './tactics-evaluator'

import {
  advanceLegacyPeriodicStatusRound,
  advanceLegacyNonPeriodicStatusRound,
  applyLegacyStatusEffect,
  calculateLegacyStatusDamage,
  isLegacyCombatUnitDisabled,
  applyLegacyStatusStatModifiers,
} from '../../engine/adapters/combat/status-effect-adapter'

import {
  advanceLegacyCombatBuffs,
  applyLegacyCombatBuff,
  calculateLegacyGroupBuffBonuses,
} from '../../engine/adapters/combat/buff-effect-adapter'

import { resolveLegacyPassiveEffects } from '../../engine/adapters/combat/passive-effect-adapter'
import { planPassiveExecution } from '../../engine/core/combat/passive-execution'
import { CombatEventDispatcher, CombatEventRecorder, type CombatEvent, type CombatEventHandler, type CombatEventJournal } from '../../engine/core/events/combat-events'
import { applyHpDamage, applyHpHealing } from '../../engine/core/combat/health'
import { calculateEffectiveHealing, calculateThornsDamage, resolveManaShield } from '../../engine/core/combat/effect-resolution'
import { createCombatActionResult, type CombatActionKind, type CombatActionOutcome, type CombatActionTargetResult } from '../../engine/core/combat/action-result'
import { markUnitDefeated } from '../../engine/core/combat/defeat'
import { resolveIncomingDamage } from '../../engine/core/combat/incoming-damage'
import { resolveAttackHit, resolveCritical } from '../../engine/core/combat/attack-resolution'
import { resolveEnemyFallbackDamage } from '../../engine/core/combat/damage-resolution'
import { nextRandom, randomIntInclusive, type RandomSource } from '../../engine/core/random/random-source'
import { advanceSkillCooldowns, getDefaultCombatSkillId, isBasicSkill, isSkillOnCooldown, normalizeSkillCooldown, resolveSkillMana, setSkillCooldown } from '../../engine/core/skills/skill-availability'
import { calculatePartyBuffBonus, isSupportedSkillEffect, resolveSkillExecution } from '../../engine/core/skills/skill-execution'
import { dispatchSkillExecutionPlan } from '../../engine/core/skills/skill-plan-dispatch'
import { resolveCombatRoundStatus } from '../../engine/core/combat/round-control'
import { executeCombatTurnQueue } from '../../engine/core/combat/turn-scheduler'
import { dispatchCombatActorTurn } from '../../engine/core/combat/actor-turn'
import { executeEnemyTurnPipeline, executeHeroTurnPipeline } from '../../engine/core/combat/actor-action'
import { resolveStatusApplication } from '../../engine/core/effects/status-application'
import { applyStatModifiers, applyStatModifiersToRecord, statRecordToFlatModifiers, type StatModifier } from '../../engine/core/stats/stat-modifier'
import { applyInitiativeSkillModifiers, calculateEffectiveResourceMaxima } from '../../engine/core/stats/derived-stats'

// ─── TIPOS DE ENTRADA ─────────────────────────────────────────────────────────

export interface HeroData {
  id: string
  profileId?: string
  name: string
  level: number
  attrs: Record<string, number>
  hpMax: number
  mpMax: number
  /** Persisted HP and MP at participant load time; values are clamped to effective maxima. */
  hpCurrent?: number
  mpCurrent?: number
  gold: number
  groupAtkBonus?: number
  combatProfile: {
    position: string
    prelimRules: any[]
    roundRules: RoundRule[]
    defenseSkills: Record<string, number | null>
    /** Per-dungeon-floor settings override the selected base profile when present. */
    levelOverrides?: Record<number, Partial<{
      position: string
      prelimRules: Array<{ skillId?: number; itemId?: number }>
      roundRules: RoundRule[]
      defenseSkills: Record<string, number | null>
    }>>
  }
  skills: Array<{ skillId: number; slug?: string; type?: 'basic' | 'active' | 'passive'; multiplier: number; manaCost: number; healPct?: number; cooldownRounds?: number; effect?: string; rank?: number; formula?: SkillFormula; tags?: string[]; name?: string; icon?: string }>
  equipStats?: Record<string, number>
  consumables?: Array<{ heroItemId: string; itemId: number; healHp?: number; healMp?: number }>
  /** Inventory row IDs removed by this in-memory simulation. */
  consumedConsumableIds?: string[]
  manaShield?: boolean
}

export interface EnemySkillRef {
  skillId: number
  name: string
  icon: string
  effect?: string
  multiplier: number
  manaCost: number
  cooldownRounds?: number
  formula?: SkillFormula
  damageType?: string
  attackCategory?: string
  defenseCategory?: string
}

export interface EnemyData {
  id: number
  name: string
  icon: string
  hp: number
  mp: number
  atk: number
  def: number
  dx: number
  ag: number
  /** Optional canonical attributes for hero-derived arena opponents. */
  attrs?: Record<string, number>
  level: number
  baseLevel?: number
  growthFactor?: number
  position: string
  isTrap?: boolean
  isBoss?: boolean
  passiveEffects?: PassiveEffect[]
  skillName?: string
  skillIcon?: string
  defenseSkill?: string
  defenseSkillIcon?: string
  damageType?: DamageType
  armorName?: string
  skillIds?: number[]
  skills?: EnemySkillRef[]
  ai?: { type: string }
  faction?: string
}

export interface DungeonLevel {
  number: number
  enemies: EnemyData[]
  epReward: number
  goldReward: number
  locationName?: string
}

export interface DungeonData {
  id: number
  name: string
  levels: DungeonLevel[]
  epReward: number
  goldReward: number
  fameReward: number
  lootTable: Array<{ itemId: number; chance: number; minQty: number; maxQty: number }>
  recommendedLevel?: number
  difficulty?: number
  growthFactor?: number
}

// ─── TIPOS DE REPORTE ─────────────────────────────────────────────────────────

export interface UnitState {
  id: string
  name: string
  icon?: string
  level: number
  position: string
  hp: number
  maxHp: number
  mp: number
  maxMp: number
  condition: string
  isHero: boolean
  trap?: boolean
  armorName?: string
  statusEffects?: Array<{ type: string; remainingRounds: number }>
  activeBuffs?: Array<{ type: string; value: number; remainingRounds: number | null; sourceName: string }>
  faction?: string
  groupAtkBonus?: number
  groupDefBonus?: number
  factionBonuses?: { atk: number; def: number; combustion: boolean; darknessHeal: boolean }
  resistances?: Partial<Record<DamageType, number>>
}

export interface StateSnapshot {
  heroes: UnitState[]
  enemies: UnitState[]
}

export interface SpecialEvent {
  type: 'boss_encounter' | 'hero_fallen' | 'faction_synergy' | 'narrow_escape' | 'massacre'
  icon: string
  description: string
  round?: number
}

export interface DamageBreakdown {
  type: DamageType
  value: number
}

export interface TargetResult {
  targetId: string
  targetName: string
  defenseValue?: number
  defenseRoll?: number
  defenseSkill?: string
  defenseEffect?: string
  resultType?: 'failed' | 'success' | 'good_success' | 'critical_success'
  damageBreakdown?: DamageBreakdown[]
  absorbed?: number
  statusEffect?: string
}

export interface DetailedAction {
  actionId?: string
  combatResult?: import('../../engine/core/combat/action-result').CombatActionResult
  initiative: number
  actionNumber: number
  totalActions: number
  actorId: string
  actorName: string
  actorIcon?: string
  skillId: number
  skillName: string
  skillIcon?: string
  mpCost?: number
  /** Why the selected skill was replaced or forced by low-mana resolution. */
  skillFallback?: 'free_basic' | 'basic' | 'forced' | 'cooldown' | 'buff_active'
  selectedSkillName?: string
  /** The configured rule that selected this action, before any execution fallback. */
  tacticRulePriority?: number
  tacticCondition?: TacticCondition
  /** Exact rule checks performed by the evaluator before choosing this action. */
  tacticRuleEvaluationTrace?: TacticRuleEvaluation[]
  targetId?: string
  targetName?: string
  attackValue?: number
  attackRollBase?: number
  attackRollDice?: number
  attackRollTotal?: number
  defenseValue?: number
  defenseRoll?: number
  defenseSkill?: string
  defenseSkillIcon?: string
  defenseEquipment?: string
  defenseEffect?: string
  resultType?: 'failed' | 'success' | 'good_success' | 'critical_success'
  damageBreakdown?: DamageBreakdown[]
  targetResults?: TargetResult[]
  healAmount?: number
  healType?: 'hp' | 'mp'
  buffName?: string
  buffValue?: number
  itemName?: string
  /** Potion-use audit fields persisted in the combat replay. */
  potionSkillName?: string
  potionSkillRank?: number
  potionWisdom?: number
  potionBaseHeal?: number
  potionSkillBonus?: number
  absorbed?: number
  fled?: boolean
  message: string
}

export interface RoundReport {
  roundNumber: number
  stateBefore: StateSnapshot
  stateAfter: StateSnapshot
  actions: DetailedAction[]
  narrative?: string
}

export interface LevelReport {
  levelNumber: number
  victory: boolean
  rounds: RoundReport[]
  /** Actual preliminary-phase log entries for this floor, in execution order. */
  preliminaryLog?: LogEntry[]
  epGained: number
  goldGained: number
  narrative?: string
  locationName?: string
  specialEvents?: SpecialEvent[]
}

// ─── TIPOS DE SALIDA ──────────────────────────────────────────────────────────

export type LogEntryType =
  | 'round_start' | 'prelim_start' | 'level_start' | 'level_complete'
  | 'tactic_eval' | 'action' | 'hit' | 'crit' | 'miss' | 'heal'
  | 'buff' | 'death' | 'victory' | 'defeat' | 'condition_change'

export interface LogEntry {
  type: LogEntryType
  round: number
  level: number
  phase: 'prelim' | 'combat'
  actor?: string
  actorId?: string
  skill?: string
  target?: string
  targetId?: string
  value?: number
  message: string
  timestamp: number
}

export interface HeroFinalState {
  id: string
  hp: number
  mp: number
}

export interface RunResult {
  victory: boolean
  levelsCleared: number
  totalRounds: number
  epGained: number
  goldGained: number
  fameGained: number
  loot: Array<{ itemId: number; qty: number; heroId?: string; heroName?: string }>
  heroesFinalState: HeroFinalState[]
  consumedConsumables?: Array<{ heroId: string; heroItemId: string }>
  log: LogEntry[]
  levelResults: Array<{ level: number; victory: boolean; rounds: number }>
  levelReports: LevelReport[]
  eventJournal: CombatEventJournal
}

type HeroSkill = {
  skillId: number
  slug?: string
  multiplier: number
  manaCost: number
  healPct?: number
  cooldownRounds?: number
  effect?: string
  rank?: number
  formula?: SkillFormula
  tags?: string[]
  name?: string
  icon?: string
}

// ─── COMBAT CONTEXT (reduce S107 param counts) ─────────────────────────────

interface CombatCtx {
  log: LogEntry[]
  round: number
  level: number
  state?: CombatState
  random?: RandomSource
  processedDeaths?: Set<string>
  events?: CombatEventDispatcher
  eventSequence?: { value: number }
}


function dispatchCombatEvent(ctx: CombatCtx, event: CombatEvent): void {
  if (!ctx.events) return
  const sequence = ctx.eventSequence ?? (ctx.eventSequence = { value: 0 })
  ctx.events.dispatch(event, `combat:${ctx.level}:${ctx.round}:${sequence.value++}`)
}

function startAttack(ctx: CombatCtx, actorId: string, targetIds: readonly string[]): string {
  const sequence = ctx.eventSequence ?? (ctx.eventSequence = { value: 0 })
  const actionId = `action:${ctx.level}:${ctx.round}:${sequence.value}`
  dispatchCombatEvent(ctx, { type: 'attack_started', actorId, targetIds: [...targetIds], actionId })
  return actionId
}

function resolveAttackEvent(ctx: CombatCtx, actorId: string, targetId: string, hit: boolean, critical?: boolean, actionId?: string): void {
  dispatchCombatEvent(ctx, {
    type: 'attack_resolved',
    actorId,
    targetIds: [targetId],
    hit,
    ...(critical === undefined ? {} : { critical }),
    ...(actionId ? { actionId } : {}),
  })
}

function emitUnitStateChanged(ctx: CombatCtx, unit: CombatUnit, changes: Extract<CombatEvent, { type: 'unit_state_changed' }>['changes']): void {
  dispatchCombatEvent(ctx, { type: 'unit_state_changed', unitId: unit.id, changes })
}
function emitCombatStateChanged(ctx: CombatCtx, changes: Extract<CombatEvent, { type: 'combat_state_changed' }>['changes']): void {
  dispatchCombatEvent(ctx, { type: 'combat_state_changed', changes })
}
function applyDamageWithEvent(unit: CombatUnit, amount: number, sourceId: string, ctx: CombatCtx, actionId?: string): number {
  const result = applyHpDamage(unit.hp, amount)
  unit.hp = result.currentHp
  if (result.applied > 0) {
    dispatchCombatEvent(ctx, { type: 'on_damage', sourceId, targetId: unit.id, damage: result.applied, ...(actionId ? { actionId } : {}) })
    emitUnitStateChanged(ctx, unit, { hp: result.currentHp, condition: getCondition(result.currentHp, unit.maxHp), defeated: result.defeated })
  }
  return result.applied
}

function applyHealingWithEvent(unit: CombatUnit, amount: number, sourceId: string, ctx: CombatCtx): number {
  const result = applyHpHealing(unit.hp, unit.maxHp, amount)
  unit.hp = result.currentHp
  if (result.applied > 0) {
    unit.condition = getCondition(result.currentHp, unit.maxHp)
    dispatchCombatEvent(ctx, { type: 'healing_applied', sourceId, targetId: unit.id, healing: result.applied })
    emitUnitStateChanged(ctx, unit, { hp: result.currentHp, condition: unit.condition, defeated: result.defeated })
  }
  return result.applied
}

interface ActionMeta {
  action?: TacticAction
  initiative: number
  actionNum: number
  totalActions: number
  mpCost?: number
}

interface ExtraUnitArrays {
  allHeroUnits?: CombatUnit[]
  allEnemyUnits?: CombatUnit[]
}

interface HeroSkillAttackInfo {
  skill: HeroSkill
  skillName: string
  formula: SkillFormula | undefined
}

interface AttackValues {
  fResult?: { base: number; diceTotal: number }
  adjAttack: number
  isArmorPen: boolean
  isCritAuto: boolean
}

interface HeroAoeProcessConfig {
  actionId?: string
  skill: HeroSkill
  skillName: string
  aCat: string
  atkTotal: number
  adjAttack: number
  isArmorPen: boolean
  isCritAuto: boolean
  formula: SkillFormula | undefined
  statusBase: number
}

interface EnemyAoeProcessConfig {
  actionId?: string
  chosenSkill: EnemySkillRef | null
  skillName: string
  aCat: string
  atkTotal: number
  adjAttack: number
  isArmorPen: boolean
}

interface EnemyDamageParams {
  fResult: { base: number; diceTotal: number } | null
  adjAttack: number
  crit: boolean
  enemy: EnemyData
  chosenSkill: EnemySkillRef | null
  isArmorPen: boolean
  dt: DamageType
}

interface DetailOptions {
  skill: any
  heroUnit: any
  target: any
  action: TacticAction
  initiative: number
  actionNum: number
  total: number
  dmg: number | null
  hit: boolean | null
  crit: boolean | null
  healA: number | null
  healT: 'hp' | 'mp' | null
  buffN: string | null
  buffV: number | null
  itemN: string | null
  defVal: number | undefined
  defRoll: number | undefined
  defSkill: string | undefined
  defEffect: string | undefined
  defEquip: string | undefined
  msg: string
  rollBase?: number
  rollDice?: number
  attackTotal?: number
  mpCost?: number
  targetResults?: TargetResult[]
  actionId?: string
}

function statusIcon(type: string): string {
  if (type === 'poison') return '☠️'
  if (type === 'burn') return '🔥'
  if (type === 'bleed') return '🩸'
  if (type === 'stun') return '💫'
  return '❄️'
}

function targetLabel(targetType: string, fallback: string): string {
  if (targetType === 'all_heroes') return 'aliados'
  if (targetType === 'all_enemies') return 'enemigos'
  return fallback
}

// ─── UTILIDADES INTERNAS ──────────────────────────────────────────────────────

export function evalDefenseFormula(formula: SkillFormula | undefined | null, attrs: Record<string, number>, rank: number, random?: RandomSource): number {
  if (!formula) return (attrs.dx ?? 5) * 2
  const r = evaluateFormula(formula, attrs, rank, random)
  return applyDiceMultiplier(r.base, r.diceTotal, formula.diceCount, formula.diceSides, formula.diceDivisor)
}

function inferAttackCategory(skill?: { attackCategory?: string; effect?: string; tags?: string[]; formula?: { damageType?: string } }, attackerPosition?: string): string {
  if (skill?.attackCategory) return skill.attackCategory
  const tags = skill?.tags ?? []
  if (tags.includes('melee')) return 'melee'
  if (tags.includes('ranged')) return 'ranged'
  if (tags.includes('magic') || tags.includes('magical')) return 'magic'
  const dt = skill?.formula?.damageType
  if (dt && ['fire','ice','lightning','arcane','dark','poison'].includes(dt)) return 'magic'
  if (attackerPosition === 'front') return 'melee'
  if (attackerPosition === 'center') return 'ranged'
  if (attackerPosition === 'rear') return 'magic'
  return 'ranged'
}

function getDefenseValue(target: CombatUnit, attackCategory: string, random: RandomSource = { next: () => Math.random() }): { total: number; base: number; dice: number } {
  const base = target.defenseValues?.[attackCategory] ?? (target.attrs?.dx ?? 5) * 2
  const sides = 6
  const dice = randomIntInclusive(random, 1, sides)
  const mult = 1 + (dice - 3.5) / 6
  return { total: Math.round(base * Math.max(0.3, mult)), base, dice }
}

const POSITION_ORDER: Record<string, number> = {
  front: 0, left_flank: 1, right_flank: 2, center: 3, rear: 4,
}

function scaleEnemy(enemy: EnemyData, effectiveLevel: number, difficultyMod: number, dungeonGrowth?: number): EnemyData {
  const baseLevel = enemy.baseLevel ?? enemy.level ?? 1
  const growth = enemy.growthFactor ?? dungeonGrowth ?? 6
  const diff = effectiveLevel - baseLevel
  const scale = 1 + diff * growth / 100
  const clamped = Math.max(0.3, Math.min(3, scale)) * difficultyMod
  return {
    ...enemy,
    hp: Math.round(enemy.hp * clamped),
    mp: Math.round((enemy.mp ?? 0) * clamped),
    atk: Math.round(enemy.atk * clamped),
    def: Math.round(enemy.def * clamped),
    dx: Math.round(enemy.dx * clamped),
    ag: Math.round(enemy.ag * clamped),
    level: Math.ceil(enemy.isBoss ? Math.max(effectiveLevel, baseLevel) : effectiveLevel),
  }
}

function mergeHeroAttrs(hero: HeroData, equip: Record<string, number>): Record<string, number> {
  const equipmentModifiers = statRecordToFlatModifiers(equip, 'equipment')
  return applyStatModifiersToRecord(hero.attrs, equipmentModifiers)
}

function applyHeroSkillModifiers(skills: HeroSkill[], merged: Record<string, number>, baseHp: number, baseMp: number, level: number): { finalHp: number; finalMp: number; merged: Record<string, number>; heroDef: number; defenseBonus: number; thornsPct: number; vampirePct: number; counterPct: number } {
  let finalHp = baseHp
  let finalMp = baseMp
  const baseDefense = calcDefenseBase(merged as any) + level * 2
  let thornsPct = 0
  let vampirePct = 0
  let counterPct = 0
  const skillModifiers: StatModifier[] = []
  const defenseModifiers: StatModifier[] = []

  skills.forEach((skill, index) => {
    if (skill.effect === 'hp_up' || skill.effect === 'mp_up') {
      // Resource passives are resolved by calculateEffectiveResourceMaxima.
    } else if (skill.effect === 'accuracy_up') {
      skillModifiers.push({ id: `skill:${index}:accuracy`, stat: 'dx', operation: 'flat', value: 5, source: 'hero-skill' })
    } else if (skill.effect === 'speed_up') {
      // Initiative passives are applied by the shared derived-stat helper below.
    } else if (skill.effect === 'fortitude') {
      defenseModifiers.push({ id: `skill:${index}:fortitude`, stat: 'defense', operation: 'flat', value: 10, source: 'hero-skill' })
    } else if (skill.effect === 'thorns') thornsPct = 20
    else if (skill.effect === 'vampire') vampirePct = 20
    else if (skill.effect === 'counter') counterPct = 30
  })

  const modifiedAttrs = applyInitiativeSkillModifiers(
    applyStatModifiersToRecord(merged, skillModifiers),
    skills.map(skill => skill.effect)
  )
  const heroDef = applyStatModifiers(baseDefense, defenseModifiers)
  return { finalHp, finalMp, merged: modifiedAttrs, heroDef, defenseBonus: heroDef - baseDefense, thornsPct, vampirePct, counterPct }
}

function buildHeroDefenseValues(ds: Record<string, number | null>, skills: HeroSkill[], merged: Record<string, number>, random: RandomSource, flatBonus = 0): { defenseValues: Record<string, number>; defenseSkillNames: Record<string, string>; defenseEffects: Record<string, string> } {
  const defenseValues: Record<string, number> = {}
  const defenseSkillNames: Record<string, string> = {}
  const defenseEffects: Record<string, string> = {}
  for (const cat of ['melee', 'ranged', 'magic']) {
    const skillId = ds[cat]
    const heroSkill = skillId ? skills.find(s => s.skillId === skillId) : null
    const formulaValue = heroSkill?.formula
      ? evalDefenseFormula(heroSkill.formula, merged, heroSkill.rank ?? 1, random)
      : (merged.dx ?? 5) * 2
    // Flat defense bonuses apply regardless of whether the category uses a skill formula or the DX fallback.
    defenseValues[cat] = formulaValue + flatBonus
    if (heroSkill) {
      defenseSkillNames[cat] = heroSkill.name ?? ''
      defenseEffects[cat] = heroSkill.effect ?? ''
    }
  }
  return { defenseValues, defenseSkillNames, defenseEffects }
}

function buildHeroResistances(equip: Record<string, number>): Partial<Record<DamageType, number>> {
  const resistances: Partial<Record<DamageType, number>> = {}
  if (equip.armor) {
    for (const dt of ['physical', 'piercing', 'bleed'] as DamageType[]) {
      resistances[dt] = (resistances[dt] ?? 0) + equip.armor
    }
  }
  for (const dt of ['fire', 'ice', 'lightning', 'poison', 'holy', 'dark', 'psychological', 'arcane'] as DamageType[]) {
    const key = `${dt}Resist`
    if (typeof equip[key] === 'number') {
      resistances[dt] = (resistances[dt] ?? 0) + equip[key]
    }
  }
  return resistances
}

function toUnit(hero: HeroData, hp: number, mp: number, random: RandomSource): CombatUnit & { attrs: Record<string, number> } {
  const equip = hero.equipStats ?? {}
  const merged = mergeHeroAttrs(hero, equip)
  const resources = calculateEffectiveResourceMaxima({
    baseHpMax: hp,
    baseMpMax: mp,
    level: hero.level,
    baseAttributes: hero.attrs,
    effectiveAttributes: merged,
    equipmentHp: equip.hp,
    equipmentMp: equip.mp,
    skillEffects: hero.skills.map(skill => skill.effect),
  })
  const { finalHp, finalMp, merged: mergedMod, heroDef, defenseBonus, thornsPct, vampirePct, counterPct } = applyHeroSkillModifiers(
    hero.skills,
    merged,
    resources.hpMax,
    resources.mpMax,
    hero.level
  )
  const equipmentDefense = Number.isFinite(equip.def) ? equip.def! : 0
  const { defenseValues, defenseSkillNames, defenseEffects } = buildHeroDefenseValues(
    hero.combatProfile.defenseSkills ?? {}, hero.skills, mergedMod, random, defenseBonus + equipmentDefense
  )
  const resistances = buildHeroResistances(equip)
  return {
    id: hero.id, name: hero.name, icon: '🧙', level: hero.level,
    hp: Math.min(finalHp, Math.max(0, hero.hpCurrent ?? finalHp)), maxHp: finalHp,
    mp: Math.min(finalMp, Math.max(0, hero.mpCurrent ?? finalMp)), maxMp: finalMp,
    isHero: true, isAlly: false,
    position: hero.combatProfile.position,
    condition: 'ready',
    attrs: mergedMod,
    def: heroDef + (Number.isFinite(equip.def) ? equip.def : 0),
    armorName: '',
    defenseValues,
    defenseSkillNames,
    defenseEffects,
    thornsPct: thornsPct > 0 ? thornsPct : undefined,
    vampirePct: vampirePct > 0 ? vampirePct : undefined,
    counterPct: counterPct > 0 ? counterPct : undefined,
    resistances,
  }
}

function applyLevelCombatProfile(
  hero: HeroData,
  unit: CombatUnit & { attrs: Record<string, number> },
  baseProfile: HeroData['combatProfile'],
  levelNumber: number,
  baseDefense: Pick<CombatUnit, 'defenseValues' | 'defenseSkillNames' | 'defenseEffects'>,
  random: RandomSource,
): void {
  const override = baseProfile.levelOverrides?.[levelNumber]
  hero.combatProfile = {
    position: override?.position ?? baseProfile.position,
    prelimRules: override?.prelimRules ?? baseProfile.prelimRules,
    roundRules: override?.roundRules ?? baseProfile.roundRules,
    defenseSkills: override?.defenseSkills ?? baseProfile.defenseSkills,
    levelOverrides: baseProfile.levelOverrides,
  }
  unit.position = hero.combatProfile.position

  if (override?.defenseSkills) {
    const equip = hero.equipStats ?? {}
    const merged = mergeHeroAttrs(hero, equip)
    const { merged: mergedMod, defenseBonus } = applyHeroSkillModifiers(
      hero.skills, merged, hero.hpMax, hero.mpMax, hero.level
    )
    const equipmentDefense = Number.isFinite(equip.def) ? equip.def! : 0
    const defense = buildHeroDefenseValues(
      hero.combatProfile.defenseSkills, hero.skills, mergedMod, random, defenseBonus + equipmentDefense
    )
    unit.defenseValues = defense.defenseValues
    unit.defenseSkillNames = defense.defenseSkillNames
    unit.defenseEffects = defense.defenseEffects
  } else {
    unit.defenseValues = { ...baseDefense.defenseValues }
    unit.defenseSkillNames = { ...baseDefense.defenseSkillNames }
    unit.defenseEffects = { ...baseDefense.defenseEffects }
  }
}

function enemyToUnit(e: EnemyData, idx: number, random: RandomSource): CombatUnit {
  const defenseValues: Record<string, number> = {}
  const defenseSkillNames: Record<string, string> = {}
  const defenseEffects: Record<string, string> = {}
  for (const cat of ['melee', 'ranged', 'magic']) {
    const defSkill = (e.skills ?? []).find(s => s.defenseCategory === cat || s.defenseCategory === 'all')
    defenseValues[cat] = defSkill?.formula
      ? evalDefenseFormula(defSkill.formula, { atk: e.atk, def: e.def, dx: e.dx, ag: e.ag, level: e.level, ...(e.attrs ?? {}) }, 1, random)
      : (e.dx ?? 5) * 2
    if (defSkill) {
      defenseSkillNames[cat] = defSkill.name ?? ''
      defenseEffects[cat] = defSkill.effect ?? ''
    }
  }
  return {
    id: `enemy_${e.id}_${idx}`,
    name: e.name, icon: e.icon ?? '👹', level: e.level ?? 1,
    hp: e.hp ?? 10, maxHp: e.hp ?? 10,
    mp: Math.max(0, e.mp ?? 0), maxMp: Math.max(1, e.mp ?? 0),
    isHero: false, isAlly: false,
    trap: e.isTrap ?? false,
    passiveEffects: e.passiveEffects,
    position: e.position ?? 'front',
    condition: 'ready',
    attrs: e.attrs,
    def: e.def ?? 5,
    armorName: e.armorName,
    attackSkillName: e.skillName,
    attackSkillIcon: e.skillIcon,
    defenseValues,
    defenseSkillNames,
    defenseEffects,
    faction: e.faction,
    resistances: buildNaturalResistances(e.faction),
  }
}

function addLog(
  log: LogEntry[], type: LogEntryType, round: number, level: number,
  phase: 'prelim' | 'combat', message: string,
  extra?: Partial<LogEntry>
) {
  log.push({ type, round, level, phase, message, timestamp: Date.now(), ...extra })
}

function rollLoot(table: DungeonData['lootTable'], random: RandomSource = { next: () => Math.random() }): Array<{ itemId: number; qty: number }> {
  const result: Array<{ itemId: number; qty: number }> = []
  for (const entry of table) {
    if (nextRandom(random) < entry.chance) {
      const qty = entry.minQty + randomIntInclusive(random, 0, entry.maxQty - entry.minQty)
      result.push({ itemId: entry.itemId, qty })
    }
  }
  return result
}

function assignLootToHeroes(
  rawLoot: Array<{ itemId: number; qty: number }>,
  heroUnits: CombatUnit[],
  random: RandomSource,
): Array<{ itemId: number; qty: number; heroId: string; heroName: string }> {
  const alive = heroUnits.filter(h => h.hp > 0)
  if (alive.length === 0) return rawLoot.map(l => ({ ...l, heroId: '', heroName: '' }))

  return rawLoot.map(l => {
    const hero = alive[randomIntInclusive(random, 0, alive.length - 1)]
    return { itemId: l.itemId, qty: l.qty, heroId: hero.id, heroName: hero.name }
  })
}

function mapHeroToUnitState(h: CombatUnit, heroBuffs: BuffEntry[] | undefined, groupAtkBonus: number | undefined, groupDefBonus: number | undefined, factionBonuses: CombatState['factionBonuses'] | undefined): UnitState {
  return {
    id: h.id, name: h.name, icon: h.icon,
    level: h.level ?? 1, position: h.position,
    hp: h.hp, maxHp: h.maxHp,
    mp: h.mp, maxMp: h.maxMp,
    condition: h.condition, isHero: true,
    armorName: h.armorName,
    statusEffects: h.statusEffects?.map(s => ({ type: s.type, remainingRounds: s.remainingRounds })),
    activeBuffs: heroBuffs,
    faction: h.faction,
    groupAtkBonus, groupDefBonus, factionBonuses,
    resistances: h.resistances,
  }
}

function mapEnemyToUnitState(e: CombatUnit, enemyBuffs: BuffEntry[] | undefined, groupAtkBonus: number | undefined, groupDefBonus: number | undefined, factionBonuses: CombatState['factionBonuses'] | undefined): UnitState {
  return {
    id: e.id, name: e.name, icon: e.icon,
    level: e.level ?? 1, position: e.position,
    hp: e.hp, maxHp: e.maxHp,
    mp: e.mp, maxMp: e.maxMp,
    condition: e.hp <= 0 ? 'dead' : e.condition, isHero: false,
    trap: e.trap ?? false,
    armorName: e.armorName,
    statusEffects: e.statusEffects?.map(s => ({ type: s.type, remainingRounds: s.remainingRounds })),
    activeBuffs: enemyBuffs,
    faction: e.faction,
    groupAtkBonus, groupDefBonus, factionBonuses,
    resistances: e.resistances,
  }
}

function buildStateSnapshot(
  heroUnits: CombatUnit[],
  enemies: CombatUnit[],
  activeBuffs?: BuffEntry[],
  groupAtkBonus?: number,
  groupDefBonus?: number,
  factionBonuses?: CombatState['factionBonuses'],
): StateSnapshot {
  const heroBuffs = activeBuffs?.filter(b => b.side === 'hero')
  const enemyBuffs = activeBuffs?.filter(b => b.side === 'enemy')
  const sortedHeroes = [...heroUnits].sort((a, b) =>
    (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9)
  )
  const sortedEnemies = [...enemies].sort((a, b) =>
    (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9)
  )
  return {
    heroes: sortedHeroes.map(h => mapHeroToUnitState(h, heroBuffs, groupAtkBonus, groupDefBonus, factionBonuses)),
    enemies: sortedEnemies.map(e => mapEnemyToUnitState(e, enemyBuffs, groupAtkBonus, groupDefBonus, factionBonuses)),
  }
}

function getSkill(hero: HeroData, skillId: number) {
  const found = hero.skills.find(s => s.skillId === skillId)
  if (found) return found
  const basic = hero.skills.find(s => isBasicSkill(s))
  if (basic) return basic
  // Fallback genérico clase-neutral
  return { skillId: 1, name: 'Ataque', multiplier: 1, manaCost: 5, effect: 'attack' as const, rank: 1, cooldownRounds: 0, formula: { attrCoeffs: { st: 1, dx: 1, in: 1, wi: 1 }, skillRankCoeff: 1, diceSides: 6, diceCount: 1, diceDivisor: 6, flatBonus: 3 } }
}

function getItem(consumables: Array<{ heroItemId: string; itemId: number; healHp?: number; healMp?: number }>, itemId: number) {
  return consumables.find(c => c.itemId === itemId)
}

function getPotionSkill(hero: HeroData) {
  return hero.skills.find(skill => skill.effect === 'use_potion')
}

function calculatePotionHpHealing(
  baseHeal: number,
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  skill: NonNullable<ReturnType<typeof getPotionSkill>>,
) {
  const rank = Math.max(1, skill.rank ?? 1)
  const wisdom = Math.max(0, heroUnit.attrs.wi ?? 0)
  const formula = skill.formula
  const wisdomBonus = wisdom * (formula?.attrCoeffs?.wi ?? 0)
  const rankBonus = rank * (formula?.skillRankCoeff ?? 0)
  const flatBonus = formula?.flatBonus ?? 0
  const bonus = Math.max(0, Math.round(wisdomBonus + rankBonus + flatBonus))
  return { amount: Math.max(0, baseHeal + bonus), rank, wisdom, bonus }
}

function consumeItem(hero: HeroData, itemId: number) {
  const consumables = hero.consumables ?? []
  const idx = consumables.findIndex(c => c.itemId === itemId)
  if (idx === -1) return
  const [consumed] = consumables.splice(idx, 1)
  ;(hero.consumedConsumableIds ??= []).push(consumed.heroItemId)
}

// ─── RONDA PRELIMINAR ─────────────────────────────────────────────────────────

function runPrelimRound(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  hero: HeroData,
  rules: any[],
  state: CombatState,
  log: LogEntry[],
  level: number
) {
  addLog(log, 'prelim_start', 0, level, 'prelim', '── Ronda preliminar ──')

  for (const rule of rules) {
    if (rule.itemId) {
      applyPrelimItem(heroUnit, hero, rule, log, level)
      continue
    }
    const skill = getSkill(hero, rule.skillId)
    applyPrelimSkill(heroUnit, skill, state, log, level)
  }
}

function applyPrelimItem(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  hero: HeroData,
  rule: any,
  log: LogEntry[],
  level: number
) {
  const item = getItem(hero.consumables ?? [], rule.itemId)
  if (!item) return
  const potionSkill = getPotionSkill(hero)
  if (!potionSkill) {
    addLog(log, 'tactic_eval', 0, level, 'prelim', `${heroUnit.name} no puede usar item_${item.itemId}: necesita aprender Tomar poción`, { actor: heroUnit.name })
    return
  }
  if (item.healHp) {
    const scaling = calculatePotionHpHealing(item.healHp, heroUnit, potionSkill)
    const actual = Math.min(scaling.amount, heroUnit.maxHp - heroUnit.hp)
    heroUnit.hp = applyHpHealing(heroUnit.hp, heroUnit.maxHp, actual).currentHp
    addLog(log, 'heal', 0, level, 'prelim', `${heroUnit.name} usa item_${item.itemId} con Tomar poción R${scaling.rank} (Sabiduría ${scaling.wisdom}): ${item.healHp} + ${scaling.bonus} = ${actual} HP`, { actor: heroUnit.name, skill: `item_${item.itemId}`, value: actual })
  }
  if (item.healMp) {
    const actual = Math.min(item.healMp, heroUnit.maxMp - heroUnit.mp)
    heroUnit.mp = Math.min(heroUnit.maxMp, heroUnit.mp + actual)
    addLog(log, 'heal', 0, level, 'prelim', `${heroUnit.name} usa item_${item.itemId} → recupera ${actual} MP`, { actor: heroUnit.name, skill: `item_${item.itemId}`, value: actual })
  }
  consumeItem(hero, rule.itemId)
}

function applyPrelimSkill(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  skill: any,
  state: CombatState,
  log: LogEntry[],
  level: number
) {
  if (skill.effect === 'party_attack_up') {
    const bonus = calculatePartyBuffBonus('party_attack_up', skill.multiplier, skill.rank)
    addBuff(state, 'atk', bonus, skill.name ?? 'ATK grupal', 'hero', BUFF_DURATION)
    addLog(log, 'buff', 0, level, 'prelim', `${heroUnit.name} usa skill_${skill.skillId} → +${bonus}% ATK grupal`, { actor: heroUnit.name, skill: `skill_${skill.skillId}`, value: bonus })
    return
  }
  if (skill.effect === 'defense_up') {
    const bonus = calculatePartyBuffBonus('defense_up', skill.multiplier, skill.rank)
    addBuff(state, 'def', bonus, skill.name ?? 'DEF grupal', 'hero', BUFF_DURATION)
    addLog(log, 'buff', 0, level, 'prelim', `${heroUnit.name} usa skill_${skill.skillId} → +${bonus}% DEF grupal`, { actor: heroUnit.name, skill: `skill_${skill.skillId}`, value: bonus })
    return
  }
  if (skill.effect === 'heal' && skill.healPct) {
    const healed = calcHeal(heroUnit.maxHp, skill.healPct)
    const actual = Math.min(healed, heroUnit.maxHp - heroUnit.hp)
    heroUnit.hp = applyHpHealing(heroUnit.hp, heroUnit.maxHp, actual).currentHp
    addLog(log, 'heal', 0, level, 'prelim', `${heroUnit.name} usa skill_${skill.skillId} → recupera ${actual} HP`, { actor: heroUnit.name, skill: `skill_${skill.skillId}`, value: actual })
  }
}

// ─── ACCIÓN DEL HÉROE ────────────────────────────────────────────────────────

function resolveDefenseEffect(
  target: CombatUnit,
  damage: number,
  defenseEffect: string | undefined,
  random: RandomSource = { next: () => Math.random() },
  ctx?: CombatCtx,
): { damage: number; absorbed: number; dodged: boolean } {
  const result = resolveIncomingDamage({
    damage,
    defense: defenseEffect,
    currentMp: target.mp,
    random,
  })
  if (result.mpSpent > 0) { target.mp -= result.mpSpent; if (ctx) emitUnitStateChanged(ctx, target, { mp: target.mp }) }
  return { damage: result.finalDamage, absorbed: result.absorbedByBarrier, dodged: result.dodged }
}

function actionResultType(hit: boolean | null, crit: boolean | null): 'failed' | 'success' | 'critical_success' | undefined {
  if (hit === null) return undefined
  if (hit) return crit ? 'critical_success' : 'success'
  return 'failed'
}

function applyDamageToTarget(target: CombatUnit, dmg: number, ctx: CombatCtx, actor: string, skillName: string, heroUnits: CombatUnit[], enemyUnits: CombatUnit[], attacker?: CombatUnit, actionId?: string): boolean {
  const appliedDamage = applyDamageWithEvent(target, dmg, attacker?.id ?? `actor:${actor}`, ctx, actionId)
  target.condition = getCondition(target.hp, target.maxHp)
  emitUnitStateChanged(ctx, target, { condition: target.condition })
  ctx.state!.damagedThisRound = appliedDamage > 0
  // Every attack route using this helper must notify the damaged unit's passives,
  // including area attacks from either side. Keep this before defeat handling.
  if (appliedDamage > 0) {
    processPassiveEffects('on_damage', target, heroUnits, enemyUnits, attacker, ctx)
  }
  addLog(ctx.log, 'hit', ctx.round, ctx.level, 'combat',
    `${actor} usa ${skillName} → ${dmg} daño (${target.name})${target.hp <= 0 ? ' — DERRIBADO' : ''}`,
    { actor, target: target.name, skill: skillName, value: dmg })
  if (target.hp <= 0) {
    processUnitDefeat(target, attacker, heroUnits, enemyUnits, ctx)
    return true
  }
  return false
}

function makeDetail(o: DetailOptions): DetailedAction {
  const sname = o.skill?.name ?? `skill_${o.skill?.skillId ?? 0}`
  const dt = o.skill?.formula?.damageType ?? 'physical'
  const breakdown: DamageBreakdown[] = o.dmg != null && o.dmg > 0 ? [{ type: dt, value: o.dmg }] : []
  const skillId = o.skill?.skillId ?? (o.action?.skillId ?? 0)
  const kind: CombatActionKind = o.itemN ? 'item' : (o.hit !== null || (o.targetResults?.length ?? 0) > 0) ? 'attack' : o.healA !== null ? 'heal' : o.buffN ? 'buff' : 'other'
  const targetOutcomes = (o.targetResults ?? []).map(result => result.resultType === 'failed' ? 'miss' : result.resultType === 'critical_success' ? 'critical' : result.resultType ? 'hit' : 'unknown')
  const outcome: CombatActionOutcome = o.hit === false || (targetOutcomes.length > 0 && targetOutcomes.every(value => value === 'miss')) ? 'miss' : o.hit === true && o.crit === true || targetOutcomes.includes('critical') ? 'critical' : o.hit === true || targetOutcomes.includes('hit') ? 'hit' : (o.healA !== null || o.buffN) ? 'support' : 'unknown'
  const targets: CombatActionTargetResult[] = (o.targetResults ?? []).map(result => ({
    targetId: result.targetId,
    targetName: result.targetName,
    outcome: result.resultType === 'failed' ? 'miss' : result.resultType === 'critical_success' ? 'critical' : result.resultType ? 'hit' : 'unknown',
    ...(result.damageBreakdown ? { damageBreakdown: result.damageBreakdown } : {}),
    ...(result.absorbed !== undefined ? { absorbed: result.absorbed } : {}),
    ...(result.statusEffect ? { statusEffect: result.statusEffect } : {}),
  }))
  if (targets.length === 0 && o.target?.id) {
    targets.push({
      targetId: o.target.id,
      targetName: o.target.name,
      outcome,
      ...(breakdown.length ? { damageBreakdown: breakdown } : {}),
    })
  }
  const combatResult = createCombatActionResult({
    ...(o.actionId ? { actionId: o.actionId } : {}),
    actorId: o.heroUnit.id,
    skillId,
    kind,
    outcome,
    targets,
    ...(breakdown.length ? { damageBreakdown: breakdown } : {}),
    ...(o.healA !== null ? { healing: { amount: o.healA, resource: o.healT ?? 'hp' } } : {}),
    ...(o.buffN ? { buff: { name: o.buffN, ...(o.buffV !== null ? { value: o.buffV } : {}) } } : {}),
    ...(o.itemN ? { itemName: o.itemN } : {}),
    ...(o.mpCost !== undefined ? { mpCost: o.mpCost } : {}),
  })
  return {
    ...(o.actionId ? { actionId: o.actionId } : {}),
    combatResult,
    initiative: o.initiative, actionNumber: o.actionNum, totalActions: o.total,
    actorId: o.heroUnit.id, actorName: o.heroUnit.name, actorIcon: o.heroUnit.icon,
    skillId,
    skillName: sname, skillIcon: o.skill?.icon,
    mpCost: o.mpCost,
    targetId: o.target?.id, targetName: o.target?.name,
    attackValue: o.skill?.multiplier ? Math.round(100 * (o.skill.multiplier ?? 1)) : undefined,
    attackRollBase: o.rollBase,
    attackRollDice: o.rollDice,
    attackRollTotal: o.attackTotal,
    defenseValue: o.defVal,
    defenseRoll: o.defRoll,
    defenseSkill: o.defSkill,
    defenseEffect: o.defEffect,
    defenseEquipment: o.defEquip,
    resultType: actionResultType(o.hit, o.crit),
    damageBreakdown: breakdown.length > 0 ? breakdown : undefined,
    targetResults: o.targetResults,
    healAmount: o.healA ?? undefined, healType: o.healT ?? undefined,
    buffName: o.buffN ?? undefined, buffValue: o.buffV ?? undefined,
    itemName: o.itemN ?? undefined,
    message: o.msg,
  }
}

function executeHeroItemAction(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  hero: HeroData,
  action: TacticAction,
  ctx: CombatCtx,
  initiative: number,
  actionNum: number,
  totalActions: number,
): DetailedAction | null {
  if (action.itemId == null) return null
  const itemId: number = action.itemId
  const item = getItem(hero.consumables ?? [], itemId)
  const potionSkill = getPotionSkill(hero)
  if (!item || !potionSkill) return null

  const itemName = `item_${item.itemId}`
  let healedHp = 0
  let healedMp = 0
  const scaling = item.healHp
    ? calculatePotionHpHealing(item.healHp, heroUnit, potionSkill)
    : null

  if (item.healHp && scaling) {
    healedHp = Math.min(scaling.amount, heroUnit.maxHp - heroUnit.hp)
    applyHealingWithEvent(heroUnit, healedHp, heroUnit.id, ctx)
    addLog(ctx.log, 'heal', ctx.round, ctx.level, 'combat',
      `${heroUnit.name} usa ${itemName} con Tomar poción R${scaling.rank} (Sabiduría ${scaling.wisdom}): ${item.healHp} + ${scaling.bonus} = ${healedHp} HP`,
      { actor: heroUnit.name, skill: itemName, value: healedHp })
  }

  if (item.healMp) {
    const previousMp = heroUnit.mp
    healedMp = Math.min(item.healMp, heroUnit.maxMp - heroUnit.mp)
    heroUnit.mp = Math.min(heroUnit.maxMp, heroUnit.mp + healedMp)
    if (heroUnit.mp !== previousMp) emitUnitStateChanged(ctx, heroUnit, { mp: heroUnit.mp })
    addLog(ctx.log, 'heal', ctx.round, ctx.level, 'combat',
      `${heroUnit.name} usa ${itemName} → recupera ${healedMp} MP`,
      { actor: heroUnit.name, skill: itemName, value: healedMp })
  }

  if (!item.healHp && !item.healMp) return null

  consumeItem(hero, itemId)
  const primaryHeal = healedHp > 0 || !healedMp ? healedHp : healedMp
  const primaryHealType = healedHp > 0 || !healedMp ? 'hp' : 'mp'
  const effects = [
    ...(item.healHp ? [`${healedHp} HP`] : []),
    ...(item.healMp ? [`${healedMp} MP`] : []),
  ]
  const msg = `${heroUnit.name} usa ${itemName} → recupera ${effects.join(' y ')}`

  const detail = makeDetail({
    skill: null, heroUnit, target: null, action, initiative, actionNum,
    total: totalActions, dmg: null, hit: null, crit: null,
    healA: primaryHeal, healT: primaryHealType,
    buffN: null, buffV: null, itemN: itemName,
    defVal: undefined, defRoll: undefined, defSkill: undefined,
    defEffect: undefined, defEquip: undefined, msg,
  })
  if (scaling) {
    detail.potionSkillName = potionSkill.name ?? 'Tomar poción'
    detail.potionSkillRank = scaling.rank
    detail.potionWisdom = scaling.wisdom
    detail.potionBaseHeal = item.healHp
    detail.potionSkillBonus = scaling.bonus
  }
  return detail
}

function handleHeroSkillMana(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  hero: HeroData,
  skill: HeroSkill,
  ctx: CombatCtx,
): { skill: HeroSkill; mpCost: number; fallback: 'free_basic' | 'basic' | 'forced' | null; selectedSkillName: string } {
  const rank = skill.rank ?? 1
  const previousMp = heroUnit.mp
  const resolution = resolveSkillMana({
    selectedSkill: skill,
    availableSkills: hero.skills,
    currentMp: heroUnit.mp,
    rank,
  })
  if (resolution.fallback === 'free_basic') {
    addLog(ctx.log, 'tactic_eval', ctx.round, ctx.level, 'combat',
      `${heroUnit.name} — sin maná para ${skill.name ?? `skill_${skill.skillId}`}, usa ${resolution.skill.name ?? 'Ataque básico'}`,
      { actor: heroUnit.name, skill: resolution.skill.name })
  } else if (resolution.fallback === 'basic') {
    addLog(ctx.log, 'tactic_eval', ctx.round, ctx.level, 'combat',
      `${heroUnit.name} — sin maná ni ataque gratis para ${skill.name ?? `skill_${skill.skillId}`}, usa ${resolution.skill.name ?? 'Ataque básico'}`,
      { actor: heroUnit.name, skill: resolution.skill.name })
  }
  heroUnit.mp = resolution.remainingMp
  if (heroUnit.mp !== previousMp) emitUnitStateChanged(ctx, heroUnit, { mp: heroUnit.mp })
  return {
    skill: resolution.skill,
    mpCost: resolution.mpCost,
    fallback: resolution.fallback,
    selectedSkillName: skill.name ?? `skill_${skill.skillId}`,
  }
}

function executeHeroHealAction(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  skill: HeroSkill,
  skillName: string,
  ctx: CombatCtx,
  meta: ActionMeta,
  target: CombatUnit | null,
): DetailedAction | null {
  const state = ctx.state!
  if (!target) {
    return makeDetail({ skill, heroUnit, target: null, action: meta.action!, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg: `${heroUnit.name} usa ${skillName} — sin objetivo para curar`, mpCost: meta.mpCost })
  }
  const healed = calcHeal(target.maxHp, skill.healPct!)
  const actual = calculateEffectiveHealing(target.hp, target.maxHp, healed)
  applyHealingWithEvent(target, actual, heroUnit.id, ctx)
  target.condition = getCondition(target.hp, target.maxHp)
  emitUnitStateChanged(ctx, target, { condition: target.condition })
  const msg = `${heroUnit.name} usa ${skillName} → ${target.name} recupera ${actual} HP`
  addLog(ctx.log, 'heal', ctx.round, ctx.level, 'combat', msg,
    { actor: heroUnit.name, target: target.name, skill: skillName, value: actual })
  return makeDetail({ skill, heroUnit, target, action: meta.action!, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: actual, healT: 'hp', buffN: null, buffV: null, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg, mpCost: meta.mpCost })
}

function executeHeroBuffAction(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  skill: HeroSkill,
  skillName: string,
  ctx: CombatCtx,
  meta: ActionMeta,
  buff: 'atk' | 'def',
  bonus: number,
): DetailedAction {
  const state = ctx.state!
  const isAtk = buff === 'atk'
  addBuff(state, isAtk ? 'atk' : 'def', bonus, skillName, 'hero', BUFF_DURATION, ctx)
  const label = isAtk ? 'ATK grupal' : 'DEF grupal'
  const msg = `${heroUnit.name} usa ${skillName} → +${bonus}% ${label}`
  addLog(ctx.log, 'buff', ctx.round, ctx.level, 'combat', msg, { actor: heroUnit.name, skill: skillName, value: bonus })
  return makeDetail({ skill, heroUnit, target: null, action: meta.action!, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: null, healT: null, buffN: label, buffV: bonus, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg, mpCost: meta.mpCost })
}

function executeHeroSelfBuffAction(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  skill: HeroSkill,
  skillName: string,
  ctx: CombatCtx,
  meta: ActionMeta,
  buff: 'atk',
  bonus: number,
): DetailedAction {
  // Two round ticks include the application round and preserve one complete
  // following hero turn, matching Venganza's one-turn design.
  const remainingRounds = 2
  heroUnit.statusEffects = [...applyLegacyStatusEffect(heroUnit.statusEffects ?? [], {
    type: 'atk_up',
    remainingRounds,
    value: bonus,
    source: skillName,
    sourceName: skillName,
  })]
  emitUnitStateChanged(ctx, heroUnit, { statusEffects: heroUnit.statusEffects.map(effect => ({ ...effect })) })
  const msg = `${heroUnit.name} usa ${skillName} → +${bonus}% ATK propio durante su próximo turno`
  addLog(ctx.log, 'buff', ctx.round, ctx.level, 'combat', msg,
    { actor: heroUnit.name, skill: skillName, value: bonus })
  return makeDetail({ skill, heroUnit, target: null, action: meta.action!, initiative: meta.initiative,
    actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null,
    healA: null, healT: null, buffN: 'ATK propio', buffV: bonus, itemN: null,
    defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined,
    defEquip: undefined, msg, mpCost: meta.mpCost })
}

function processAoeTarget(
  enemy: CombatUnit,
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  cfg: HeroAoeProcessConfig,
  ctx: CombatCtx,
): TargetResult {
  const { actionId, skill, skillName, aCat, atkTotal, adjAttack, isArmorPen, isCritAuto, formula, statusBase } = cfg
  const state = ctx.state!
  const allHeroUnits = [state.hero, ...state.allies]
  const allEnemyUnits = state.enemies
  const { total: defVal, dice: defDice } = getDefenseValue(enemy, aCat, ctx.random)
  const hit = resolveAttackHit({ attackTotal: atkTotal, defenseValue: defVal }).hit
  if (!hit) {
    resolveAttackEvent(ctx, heroUnit.id, enemy.id, false, undefined, actionId)
    addLog(ctx.log, 'miss', ctx.round, ctx.level, 'combat',
      `${heroUnit.name} usa ${skillName} → fallo (${enemy.name})`,
      { actor: heroUnit.name, target: enemy.name, skill: skillName })
    return {
      targetId: enemy.id, targetName: enemy.name,
      defenseValue: defVal, defenseRoll: defDice, defenseSkill: enemy.defenseSkillNames?.[aCat],
      defenseEffect: enemy.defenseEffects?.[aCat],
      resultType: 'failed',
    }
  }
  const critRoll = resolveCritical({ attackerDexterity: heroUnit.attrs.dx, forced: isCritAuto, random: ctx.random ?? { next: () => Math.random() } }).critical
  resolveAttackEvent(ctx, heroUnit.id, enemy.id, true, critRoll, actionId)
  const critAdj = critRoll ? Math.round(adjAttack * CRIT_MULTIPLIER) : adjAttack
  const dt = formula?.damageType ?? 'physical'
  const dmg = calcActualDamage(applyLegacyStatusStatModifiers(critAdj, heroUnit.statusEffects ?? [], 'attack'), groupBuffBonusesForSide(state, 'hero').atk, applyLegacyStatusStatModifiers(enemy.def ?? 5, enemy.statusEffects ?? [], 'defense'), isArmorPen, dt, enemy.resistances, groupBuffBonusesForSide(state, 'enemy').def)
  const defEff = enemy.defenseEffects?.[aCat]
  const resolved = resolveDefenseEffect(enemy, dmg, defEff, ctx.random, ctx)
  const finalDmg = resolved.damage
  const hpBefore = enemy.hp
  applyDamageToTarget(enemy, finalDmg, ctx, heroUnit.name, skillName, allHeroUnits, allEnemyUnits, heroUnit, actionId)
  const appliedDamage = Math.max(0, hpBefore - enemy.hp)
  if (enemy.hp > 0 && !resolved.dodged && dt !== 'physical') {
    applyStatusEffectFromDamage(dt, statusBase, enemy, heroUnit.name, ctx)
  }
  applyCritEffects(critRoll, enemy, finalDmg, ctx, heroUnit.name)
  applyVampireHeal(heroUnit, appliedDamage, ctx)
  const tr: TargetResult = {
    targetId: enemy.id, targetName: enemy.name,
    defenseValue: defVal, defenseRoll: defDice, defenseSkill: enemy.defenseSkillNames?.[aCat],
    defenseEffect: defEff,
    resultType: critRoll ? 'critical_success' : 'success',
    damageBreakdown: [{ type: dt, value: finalDmg }],
  }
  if (resolved.absorbed > 0) tr.absorbed = resolved.absorbed
  return tr
}

function executeHeroAoeAttack(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  skillInfo: HeroSkillAttackInfo,
  ctx: CombatCtx,
  meta: ActionMeta,
  atkValues: AttackValues,
  statusBase: number,
  targets: readonly CombatUnit[],
): DetailedAction {
  const { skill, skillName, formula } = skillInfo
  const { adjAttack, isArmorPen, isCritAuto } = atkValues
  const state = ctx.state!
  const atkTotal = adjAttack
  const aCat = inferAttackCategory(skill, heroUnit.position)
  const actionId = targets.length > 0 ? startAttack(ctx, heroUnit.id, targets.map(target => target.id)) : undefined
  const targetResults: TargetResult[] = []
  for (const enemy of targets) {
    const aoeCfg: HeroAoeProcessConfig = { actionId, skill, skillName, aCat, atkTotal, adjAttack, isArmorPen, isCritAuto, formula, statusBase }
    const tr = processAoeTarget(enemy, heroUnit, aoeCfg, ctx)
    targetResults.push(tr)
  }
  return makeDetail({ skill, heroUnit, target: null, action: meta.action!, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg: `${heroUnit.name} usa ${skillName} — ataque múltiple`, mpCost: meta.mpCost, targetResults, actionId })
}

function buildHeroAttackLogMessage(heroUnit: CombatUnit & { attrs: Record<string, number> }, skillName: string, critRoll: boolean, isCritAuto: boolean, finalDmg: number, resolved: { dodged: boolean; absorbed: number }, target: CombatUnit): string {
  let critMsg = ''
  if (isCritAuto) critMsg = ' 💥 CRÍTICO AUTO'
  else if (critRoll) critMsg = ' 💥 CRÍTICO'
  let defSuffix = ''
  if (resolved.dodged) defSuffix = ' 🦅 ESQUIVÓ'
  else if (resolved.absorbed > 0) defSuffix = ` (🛡️ ${resolved.absorbed} absorbido)`
  return `${heroUnit.name} usa ${skillName}${critMsg} → ${finalDmg} daño${defSuffix} (${target.name})${target.hp <= 0 ? ' — DERRIBADO' : ''}`
}

function applyStatusEffectFromDamage(dt: string, atkOrBase: number, target: CombatUnit, sourceName: string, ctx: CombatCtx): void {
  const se = resolveStatusApplication(dt, atkOrBase)
  if (se) applyStatusEffect(target, se.type, se.value, se.rounds, sourceName, ctx)
}

function executeHeroSingleTargetAttack(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  skillInfo: HeroSkillAttackInfo,
  ctx: CombatCtx,
  meta: ActionMeta,
  atkValues: AttackValues,
  resolvedTarget: CombatUnit | null,
  extraUnits?: ExtraUnitArrays,
): DetailedAction | null {
  const { skill, skillName, formula } = skillInfo
  const { fResult, adjAttack, isArmorPen, isCritAuto } = atkValues
  const state = ctx.state!
  const allHeroUnits = extraUnits?.allHeroUnits ?? [state.hero, ...state.allies]
  const allEnemyUnits = extraUnits?.allEnemyUnits ?? state.enemies
  const target = resolvedTarget
  if (!target) return null
  const actionId = startAttack(ctx, heroUnit.id, [target.id])

  const aCat = inferAttackCategory(skill, heroUnit.position)
  const atkTotal = adjAttack
  const { total: defVal, dice: defDice } = getDefenseValue(target, aCat, ctx.random)
  const hit = resolveAttackHit({ attackTotal: atkTotal, defenseValue: defVal }).hit
  if (!hit) {
    resolveAttackEvent(ctx, heroUnit.id, target.id, false, undefined, actionId)
    const msg = `${heroUnit.name} usa ${skillName} → fallo`
    addLog(ctx.log, 'miss', ctx.round, ctx.level, 'combat', msg, { actor: heroUnit.name, target: target.name, skill: skillName })
    return makeDetail({ skill, heroUnit, target, action: meta.action!, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: false, crit: null, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal, defRoll: defDice, defSkill: undefined, defEffect: target.defenseEffects?.[aCat], defEquip: target.armorName, msg, rollBase: fResult!.base, rollDice: fResult!.diceTotal, attackTotal: atkTotal, mpCost: meta.mpCost, actionId })
  }

  const critRoll = resolveCritical({ attackerDexterity: heroUnit.attrs.dx, forced: isCritAuto, random: ctx.random ?? { next: () => Math.random() } }).critical
  resolveAttackEvent(ctx, heroUnit.id, target.id, true, critRoll, actionId)
  const critAdj = critRoll ? Math.round(adjAttack * CRIT_MULTIPLIER) : adjAttack
  const dt = formula?.damageType ?? 'physical'
  const dmg = calcActualDamage(applyLegacyStatusStatModifiers(critAdj, heroUnit.statusEffects ?? [], 'attack'), groupBuffBonusesForSide(state, 'hero').atk, applyLegacyStatusStatModifiers(target.def ?? 5, target.statusEffects ?? [], 'defense'), isArmorPen, dt, target.resistances, groupBuffBonusesForSide(state, target.isHero ? 'hero' : 'enemy').def)

  const defEff = target.defenseEffects?.[aCat]
  const resolved = resolveDefenseEffect(target, dmg, defEff, ctx.random, ctx)
  const finalDmg = resolved.damage

  const appliedDamage = applyDamageWithEvent(target, finalDmg, heroUnit.id, ctx, actionId)
  target.condition = getCondition(target.hp, target.maxHp)
  state.damagedThisRound = appliedDamage > 0
  // Resolve damage passives at the HP-loss boundary, matching AoE, enemy, and DoT paths.
  if (appliedDamage > 0) {
    processPassiveEffects('on_damage', target, allHeroUnits, allEnemyUnits, heroUnit, ctx)
  }

  if (!resolved.dodged && target.hp > 0 && formula?.damageType && formula.damageType !== 'physical') {
    applyStatusEffectFromDamage(formula.damageType, fResult!.base, target, heroUnit.name, ctx)
  }

  applyCritEffects(critRoll, target, finalDmg, ctx, heroUnit.name)
  applyVampireHeal(heroUnit, appliedDamage, ctx)

  const msg = buildHeroAttackLogMessage(heroUnit, skillName, critRoll, isCritAuto, finalDmg, resolved, target)
  addLog(ctx.log, critRoll ? 'crit' : 'hit', ctx.round, ctx.level, 'combat', msg, { actor: heroUnit.name, target: target.name, skill: skillName, value: finalDmg })
  if (target.hp <= 0) processUnitDefeat(target, heroUnit, allHeroUnits, allEnemyUnits, ctx)
  const detail = makeDetail({ skill, heroUnit, target, action: meta.action!, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: finalDmg, hit: true, crit: critRoll, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal, defRoll: defDice, defSkill: undefined, defEffect: defEff, defEquip: target.armorName, msg, rollBase: fResult!.base, rollDice: fResult!.diceTotal, attackTotal: atkTotal, mpCost: meta.mpCost, actionId })
  if (resolved.absorbed > 0) detail.absorbed = resolved.absorbed
  return detail
}

function executeHeroAction(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  hero: HeroData,
  meta: ActionMeta,
  ctx: CombatCtx,
  extraUnits?: ExtraUnitArrays,
): DetailedAction | null {
  const state = ctx.state!
  const action = meta.action!
  if (action.itemId != null) {
    const item = getItem(hero.consumables ?? [], action.itemId)
    const potionSkill = getPotionSkill(hero)
    if (!item || !potionSkill) {
      const reason = !item ? 'el consumible ya no está disponible' : 'no conoce la habilidad Tomar poción'
      addLog(ctx.log, 'tactic_eval', ctx.round, ctx.level, 'combat',
        `${heroUnit.name} no puede usar item_${action.itemId}: ${reason}. Ejecuta un ataque básico`,
        { actor: heroUnit.name, skill: 'Tomar poción' })
      // A failed consumable action becomes a normal basic attack; never carry the
      // consumable's self-target setting into that offensive fallback.
      const fallbackAction = {
        ...action,
        itemId: undefined,
        skillId: getDefaultCombatSkillId(hero.skills),
        targetPos: 'auto' as const,
        targetType: 'weakest' as const,
      }
      const fallbackResult = executeHeroAction(
        heroUnit, hero, { ...meta, action: fallbackAction }, ctx, extraUnits,
      )
      if (fallbackResult) {
        fallbackResult.skillFallback = 'forced'
        fallbackResult.selectedSkillName = 'Tomar poción'
      }
      return fallbackResult
    }
    return executeHeroItemAction(heroUnit, hero, action, ctx, meta.initiative, meta.actionNum, meta.totalActions)
  }

  let skill = getSkill(hero, action.skillId)
  if (!isSupportedSkillEffect(skill.effect, skill.slug)) {
    const skillName = skill.name ?? `skill_${skill.skillId}`
    addLog(ctx.log, 'tactic_eval', ctx.round, ctx.level, 'combat',
      `${heroUnit.name} no puede ejecutar ${skillName}: el efecto "${skill.effect}" todavía no está implementado. No consume maná ni aplica un ataque alternativo.`,
      { actor: heroUnit.name, skill: skillName })
    return null
  }
  const { skill: resolvedSkill, mpCost, fallback, selectedSkillName } = handleHeroSkillMana(heroUnit, hero, skill, ctx)
  skill = resolvedSkill

  // Formula, rank and report identity must follow the skill actually executed.
  // A low-mana fallback can replace the selected skill with a basic attack.
  const skillName = skill.name ?? `skill_${skill.skillId}`
  const rank = skill.rank ?? 1
  const formula = skill.formula

  // Legacy attack formulas consume their dice before random target selection.
  // Keep that order so seeded combat streams remain compatible.
  const isSupportSkill = (skill.effect === 'heal' && !!skill.healPct)
    || skill.effect === 'party_attack_up'
    || skill.effect === 'defense_up'
    || (skill.effect === 'buff' && skill.slug === 'venganza')
  const fResult = isSupportSkill ? null : evaluateFormula(formula, heroUnit.attrs, rank, ctx.random)

  const plan = resolveSkillExecution({
    skill: {
      skillId: skill.skillId,
      slug: skill.slug,
      name: skill.name,
      effect: skill.effect,
      multiplier: skill.multiplier,
      rank,
      healPct: skill.healPct,
      tags: skill.tags,
    },
    actor: heroUnit,
    allies: [state.hero, ...state.allies].filter(unit => unit.id !== heroUnit.id),
    enemies: state.enemies,
    action: { targetPos: action.targetPos, targetType: action.targetType },
    random: ctx.random ?? { next: () => Math.random() },
  })

  const skillInfo: HeroSkillAttackInfo = { skill, skillName, formula }
  const detailedAction = dispatchSkillExecutionPlan(plan, {
    heal: target => executeHeroHealAction(heroUnit, skill, skillName, ctx, { ...meta, mpCost }, target),
    party_buff: (buff, bonus) => executeHeroBuffAction(heroUnit, skill, skillName, ctx, { ...meta, mpCost }, buff, bonus),
    self_buff: (buff, bonus) => executeHeroSelfBuffAction(heroUnit, skill, skillName, ctx, { ...meta, mpCost }, buff, bonus),
    area_attack: (targets, armorPenetration, critical) => {
      const resolvedFormula = fResult!
      const adjAttack = applyDiceMultiplier(resolvedFormula.base, resolvedFormula.diceTotal, formula?.diceCount ?? 0, formula?.diceSides ?? 0, formula?.diceDivisor)
      const atkValues: AttackValues = { adjAttack, isArmorPen: armorPenetration, isCritAuto: critical }
      return executeHeroAoeAttack(heroUnit, skillInfo, ctx, { ...meta, mpCost }, atkValues, resolvedFormula.base, targets)
    },
    single_attack: (target, armorPenetration, critical) => {
      const resolvedFormula = fResult!
      const adjAttack = applyDiceMultiplier(resolvedFormula.base, resolvedFormula.diceTotal, formula?.diceCount ?? 0, formula?.diceSides ?? 0, formula?.diceDivisor)
      const atkValues: AttackValues = { fResult: resolvedFormula, adjAttack, isArmorPen: armorPenetration, isCritAuto: critical }
      return executeHeroSingleTargetAttack(heroUnit, skillInfo, ctx, { ...meta, mpCost }, atkValues, target, extraUnits)
    },
    unsupported: () => null,
  })
  if (detailedAction && fallback) {
    detailedAction.skillFallback = fallback
    detailedAction.selectedSkillName = selectedSkillName
  }
  return detailedAction
}

// ─── ACCIÓN DEL ENEMIGO (IA SIMPLE) ─────────────────────────────────────────

function isEnemySkillOnCooldown(state: CombatState, actorId: string, skillId: number): boolean {
  return isSkillOnCooldown(state.skillCooldowns, actorId, skillId)
}

function pickEnemySkill(enemy: EnemyData, enemyUnit: CombatUnit, state: CombatState, round: number): EnemySkillRef | null {
  const enemySkills = (enemy.skills ?? []).filter(s => !isEnemySkillOnCooldown(state, enemyUnit.id, s.skillId))
  if (enemyUnit.hp < enemyUnit.maxHp * 0.4) {
    const heal = enemySkills.find(s => s.effect === 'heal')
    if (heal) return heal
  }
  if (enemyUnit.hp > enemyUnit.maxHp * 0.7) {
    const buffSkill = enemySkills.find(s => s.effect === 'party_attack_up' || s.effect === 'defense_up')
    if (buffSkill && (
      (buffSkill.effect === 'party_attack_up' && groupBuffBonusesForSide(state, 'enemy').atk === 0) ||
      (buffSkill.effect === 'defense_up' && groupBuffBonusesForSide(state, 'enemy').def === 0)
    )) {
      return buffSkill
    }
  }
  const atkSkills = enemySkills.filter(s => !s.effect || s.effect === 'attack' || s.effect === 'armor_penetration' || s.effect === 'aoe_attack')
  return atkSkills.length > 0 ? atkSkills[round % atkSkills.length] : null
}

function makeEnemySkillObj(chosenSkill: EnemySkillRef | null, enemy: EnemyData, skillName: string, skillIcon: string | undefined, damageType: DamageType): any {
  return { skillId: chosenSkill?.skillId ?? enemy.id, name: skillName, icon: skillIcon, multiplier: chosenSkill?.multiplier ?? enemy.atk / 10, formula: { damageType } }
}

function executeEnemyBuffEffect(enemy: EnemyData, enemyUnit: CombatUnit, chosenSkill: EnemySkillRef, skillName: string, buff: 'atk' | 'def', bonus: number, ctx: CombatCtx, meta: ActionMeta): DetailedAction {
  const state = ctx.state!
  addBuff(state, buff, bonus, skillName, 'enemy', BUFF_DURATION, ctx)
  const label = buff === 'atk' ? 'ATK grupal' : 'DEF grupal'
  const msg = enemyUnit.name + ' usa ' + skillName + ' → +' + bonus + '% ' + label + ' enemigos'
  addLog(ctx.log, 'buff', ctx.round, ctx.level, 'combat', msg, { actor: enemyUnit.name, skill: skillName, value: bonus })
  const sk = makeEnemySkillObj(chosenSkill, enemy, skillName, chosenSkill.icon, (chosenSkill.damageType ?? 'physical') as DamageType)
  return makeDetail({ skill: sk, heroUnit: enemyUnit, target: null, action: { skillId: enemy.id, targetPos: 'auto', targetType: 'self' }, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: null, healT: null, buffN: label, buffV: bonus, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg })
}

function executeEnemyHealEffect(enemy: EnemyData, enemyUnit: CombatUnit, target: CombatUnit, chosenSkill: EnemySkillRef, skillName: string, healPct: number, ctx: CombatCtx, meta: ActionMeta): DetailedAction | null {
  if (target.hp >= target.maxHp || target.hp <= 0) return null
  const healed = calcHeal(target.maxHp, healPct)
  const actual = Math.min(healed, target.maxHp - target.hp)
  applyHealingWithEvent(target, actual, enemyUnit.id, ctx)
  const msg = enemyUnit.name + ' usa ' + skillName + ' → recupera ' + actual + ' HP'
  addLog(ctx.log, 'heal', ctx.round, ctx.level, 'combat', msg, { actor: enemyUnit.name, target: target.name, skill: skillName, value: actual })
  const sk = makeEnemySkillObj(chosenSkill, enemy, skillName, chosenSkill.icon, (chosenSkill.damageType ?? 'physical') as DamageType)
  return makeDetail({ skill: sk, heroUnit: enemyUnit, target, action: { skillId: enemy.id, targetPos: 'auto', targetType: 'self' }, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: actual, healT: 'hp', buffN: null, buffV: null, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg })
}

function processEnemyAoeTarget(hero: CombatUnit, enemy: EnemyData, enemyUnit: CombatUnit, cfg: EnemyAoeProcessConfig, ctx: CombatCtx): TargetResult {
  const { actionId, chosenSkill, skillName, aCat, atkTotal, adjAttack, isArmorPen } = cfg
  const state = ctx.state!
  const heroUnits = [state.hero, ...state.allies]
  const allEnemyUnits = state.enemies
  const { total: defVal, dice: defDice } = getDefenseValue(hero, aCat, ctx.random)
  const hit = defVal <= atkTotal
  if (!hit) {
    resolveAttackEvent(ctx, enemyUnit.id, hero.id, false, undefined, actionId)
    addLog(ctx.log, 'miss', ctx.round, ctx.level, 'combat', `${enemyUnit.name} usa ${skillName} → fallo (${hero.name})`, { actor: enemyUnit.name, target: hero.name, skill: skillName })
    return {
      targetId: hero.id, targetName: hero.name,
      defenseValue: defVal, defenseRoll: defDice, defenseSkill: hero.defenseSkillNames?.[aCat],
      defenseEffect: hero.defenseEffects?.[aCat],
      resultType: 'failed',
    }
  }
  const critRoll = resolveCritical({ attackerDexterity: enemy.dx, random: ctx.random ?? { next: () => Math.random() } }).critical
  resolveAttackEvent(ctx, enemyUnit.id, hero.id, true, critRoll, actionId)
  const critAdj = critRoll ? Math.round(adjAttack * CRIT_MULTIPLIER) : adjAttack
  const dt: DamageType = (chosenSkill?.damageType ?? enemy.damageType ?? 'physical') as DamageType
  const dmg = calcActualDamage(applyLegacyStatusStatModifiers(critAdj, enemyUnit.statusEffects ?? [], 'attack'), groupBuffBonusesForSide(state, 'enemy').atk, applyLegacyStatusStatModifiers(hero.def ?? 5, hero.statusEffects ?? [], 'defense'), isArmorPen, dt, hero.resistances, groupBuffBonusesForSide(state, 'hero').def)
  const defEff = hero.defenseEffects?.[aCat]
  const resolved = resolveDefenseEffect(hero, dmg, defEff, ctx.random, ctx)
  const shield = applyManaShieldAbsorption(hero, state, resolved.damage, ctx)
  const finalDmg = shield.finalDmg
  // Reactions scale from HP actually removed, not overkill damage.
  const appliedDamage = Math.min(hero.hp, finalDmg)
  applyDamageToTarget(hero, finalDmg, ctx, enemyUnit.name, skillName, heroUnits, allEnemyUnits, enemyUnit, actionId)
  // Area attacks must trigger the same defender reactions as single-target attacks.
  applyThornsReflect(hero, enemyUnit, appliedDamage, ctx, heroUnits, allEnemyUnits)
  applyCounterAttack(hero, enemyUnit, appliedDamage, aCat, ctx, heroUnits, allEnemyUnits)
  if (hero.hp > 0 && !resolved.dodged && dt !== 'physical') {
    applyStatusEffectFromDamage(dt, enemy.atk, hero, enemyUnit.name, ctx)
  }
  applyCritEffects(critRoll, hero, finalDmg, ctx, enemyUnit.name)
  const tr: TargetResult = {
    targetId: hero.id, targetName: hero.name,
    defenseValue: defVal, defenseRoll: defDice, defenseSkill: hero.defenseSkillNames?.[aCat],
    defenseEffect: defEff,
    resultType: critRoll ? 'critical_success' : 'success',
    damageBreakdown: [{ type: dt, value: finalDmg }],
  }
  const totalAbsorbed = resolved.absorbed + shield.absorbed
  if (totalAbsorbed > 0) tr.absorbed = totalAbsorbed
  return tr
}

function executeEnemyAoeAttack(
  enemy: EnemyData,
  enemyUnit: CombatUnit,
  heroUnits: CombatUnit[],
  actionSkill: { chosenSkill: EnemySkillRef | null; skillName: string },
  atkValues: { fResult: { base: number; diceTotal: number }; adjAttack: number; isArmorPen: boolean },
  ctx: CombatCtx,
  meta: ActionMeta,
  targets: readonly CombatUnit[],
): DetailedAction {
  const { chosenSkill, skillName } = actionSkill
  const { fResult, adjAttack, isArmorPen } = atkValues
  const atkTotal = adjAttack
  const aCat = inferAttackCategory(chosenSkill ?? undefined, enemyUnit.position)
  const actionId = targets.length > 0 ? startAttack(ctx, enemyUnit.id, targets.map(target => target.id)) : undefined
  const targetResults: TargetResult[] = []
  for (const hero of targets) {
    const aoeCfg: EnemyAoeProcessConfig = { actionId, chosenSkill, skillName, aCat, atkTotal, adjAttack, isArmorPen }
    const tr = processEnemyAoeTarget(hero, enemy, enemyUnit, aoeCfg, ctx)
    targetResults.push(tr)
  }
  const sk = makeEnemySkillObj(chosenSkill, enemy, skillName, chosenSkill?.icon ?? enemy.skillIcon, (chosenSkill?.damageType ?? enemy.damageType ?? 'physical') as DamageType)
  return makeDetail({ skill: sk, heroUnit: enemyUnit, target: null, action: { skillId: enemy.id, targetPos: 'auto', targetType: 'weakest' }, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg: `${enemyUnit.name} usa ${skillName} — ataque múltiple`, targetResults, actionId })
}

function executeEnemySingleTargetAttack(
  enemy: EnemyData, enemyUnit: CombatUnit, heroUnits: CombatUnit[],
  chosenSkill: EnemySkillRef | null, skillName: string, damageType: DamageType,
  fResult: { base: number; diceTotal: number } | null, adjAttack: number, isArmorPen: boolean,
  target: CombatUnit, state: CombatState, ctx: CombatCtx,
  initiative: number, actionNum: number, totalActions: number,
  aCat: string
 ): DetailedAction | null {
  const allEnemyUnits = state.enemies
  const actionId = startAttack(ctx, enemyUnit.id, [target.id])
  const { total: defVal, dice: defDice } = getDefenseValue(target, aCat, ctx.random)
  const { hit, rollBase, rollDice, attackTotal } = computeEnemyHitValues(fResult, adjAttack, enemy, defVal, ctx.random)

  if (!hit) {
    resolveAttackEvent(ctx, enemyUnit.id, target.id, false, undefined, actionId)
    return makeEnemyMissDetail(enemy, enemyUnit, chosenSkill, skillName, damageType, target, defVal, defDice, aCat, attackTotal, rollBase, rollDice, ctx, initiative, actionNum, totalActions, actionId)
  }

  const crit = resolveCritical({ attackerDexterity: enemy.dx, random: ctx.random ?? { next: () => Math.random() } }).critical
  resolveAttackEvent(ctx, enemyUnit.id, target.id, true, crit, actionId)
  const dmg = computeEnemyDamageWithFallback({ fResult, adjAttack, crit, enemy, chosenSkill, isArmorPen, dt: damageType }, ctx, enemyUnit, target)
  const defEff = target.defenseEffects?.[aCat]
  const resolved = resolveDefenseEffect(target, dmg, defEff, ctx.random)
  let finalDmg = resolved.damage
  const { absorbed, finalDmg: afterShield } = applyManaShieldAbsorption(target, state, finalDmg, ctx)
  finalDmg = afterShield

  const appliedDamage = applyDamageWithEvent(target, finalDmg, enemyUnit.id, ctx, actionId)
  target.condition = getCondition(target.hp, target.maxHp)
  state.damagedThisRound = appliedDamage > 0
  if (appliedDamage > 0) {
    processPassiveEffects('on_damage', target, heroUnits, allEnemyUnits, enemyUnit, ctx)
  }

  applyThornsReflect(target, enemyUnit, appliedDamage, ctx, heroUnits, allEnemyUnits)
  applyCritEffects(crit, target, finalDmg, ctx, enemyUnit.name)
  applyCounterAttack(target, enemyUnit, appliedDamage, aCat, ctx, heroUnits, allEnemyUnits)

  const defSuffix = buildEnemyDefSuffix(resolved, absorbed)
  const msg = buildEnemyAttackMessage(enemyUnit, skillName, attackTotal, crit, finalDmg, defSuffix, target)
  addLog(ctx.log, crit ? 'crit' : 'hit', ctx.round, ctx.level, 'combat', msg, { actor: enemyUnit.name, target: target.name, value: finalDmg })
  applyEnemyPostDamageEffects(target, damageType, enemy, enemyUnit, resolved, ctx, state, heroUnits, allEnemyUnits)

  const sk = makeEnemySkillObj(chosenSkill, enemy, skillName, chosenSkill?.icon ?? enemy.skillIcon, damageType)
  const detail = makeDetail({ skill: sk, heroUnit: enemyUnit, target, action: { skillId: enemy.id, targetPos: 'auto', targetType: 'weakest' }, initiative, actionNum, total: totalActions, dmg: finalDmg > 0 ? finalDmg : dmg, hit: true, crit, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal, defRoll: defDice, defSkill: undefined, defEffect: defEff, defEquip: target.armorName, msg, rollBase, rollDice, attackTotal, actionId })
  if (absorbed > 0) detail.absorbed = absorbed
  if (resolved.absorbed > 0) detail.absorbed = (detail.absorbed ?? 0) + resolved.absorbed
  return detail
}

function makeEnemyMissDetail(
  enemy: EnemyData, enemyUnit: CombatUnit, chosenSkill: EnemySkillRef | null,
  skillName: string, damageType: DamageType, target: CombatUnit,
  defVal: number, defDice: number, aCat: string, attackTotal: number,
  rollBase: number, rollDice: number, ctx: CombatCtx,
  initiative: number, actionNum: number, totalActions: number, actionId?: string
): DetailedAction {
  const msg = `${enemyUnit.name} ataca (${skillName}/${attackTotal}) → ${target.name}: fallo`
  addLog(ctx.log, 'miss', ctx.round, ctx.level, 'combat', msg, { actor: enemyUnit.name, target: target.name })
  const sk = makeEnemySkillObj(chosenSkill, enemy, skillName, chosenSkill?.icon ?? enemy.skillIcon, damageType)
  return makeDetail({ skill: sk, heroUnit: enemyUnit, target, action: { skillId: enemy.id, targetPos: 'auto', targetType: 'weakest' }, initiative, actionNum, total: totalActions, dmg: null, hit: false, crit: null, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal, defRoll: defDice, defSkill: undefined, defEffect: target.defenseEffects?.[aCat], defEquip: target.armorName, msg, rollBase, rollDice, attackTotal, actionId })
}

function buildEnemyDefSuffix(resolved: { dodged: boolean; absorbed: number }, absorbed: number): string {
  let s = ''
  if (resolved.dodged) s = ' 🦅 ESQUIVÓ'
  else if (resolved.absorbed > 0) s = ` (🛡️ ${resolved.absorbed} barrera)`
  if (absorbed > 0) s += ` (mana ${absorbed})`
  return s
}

function buildEnemyAttackMessage(enemyUnit: CombatUnit, skillName: string, attackTotal: number, crit: boolean, finalDmg: number, defSuffix: string, target: CombatUnit): string {
  return `${enemyUnit.name} ataca (${skillName}/${attackTotal})${crit ? ' 💥 CRÍTICO' : ''} → ${finalDmg} daño${defSuffix} (${target.name})${target.hp <= 0 ? ' — DERRIBADO' : ''}`
}

function applyEnemyPostDamageEffects(target: CombatUnit, damageType: DamageType, enemy: EnemyData, enemyUnit: CombatUnit, resolved: { dodged: boolean }, ctx: CombatCtx, state: CombatState, heroUnits: CombatUnit[], enemyUnits: CombatUnit[]): void {
  if (target.hp <= 0) {
    processUnitDefeat(target, enemyUnit, heroUnits, enemyUnits, ctx)
    return
  }
  if (!resolved.dodged && damageType && damageType !== 'physical') {
    applyStatusEffectFromDamage(damageType, enemy.atk, target, enemyUnit.name, ctx)
  }
  if (!resolved.dodged && state.factionBonuses?.combustion) {
    const burnVal = Math.max(1, Math.round(enemy.atk * 0.2))
    applyStatusEffect(target, 'burn', burnVal, 2, enemyUnit.name, ctx)
  }
}

function computeEnemyDamageWithFallback(params: EnemyDamageParams, ctx: CombatCtx, attackerUnit: CombatUnit, target: CombatUnit): number {
  const { fResult, adjAttack, crit, enemy, chosenSkill, isArmorPen, dt } = params
  const state = ctx.state!
  if (fResult) {
    const critAdj = crit ? Math.round(adjAttack * CRIT_MULTIPLIER) : adjAttack
    return calcActualDamage(applyLegacyStatusStatModifiers(critAdj, attackerUnit.statusEffects ?? [], 'attack'), groupBuffBonusesForSide(state, attackerUnit.isHero ? 'hero' : 'enemy').atk, applyLegacyStatusStatModifiers(target.def ?? 5, target.statusEffects ?? [], 'defense'), isArmorPen, dt, target.resistances, groupBuffBonusesForSide(state, target.isHero ? 'hero' : 'enemy').def)
  }
  const skillMult = chosenSkill?.multiplier ?? 1
  return resolveEnemyFallbackDamage({
    enemyAttack: applyLegacyStatusStatModifiers(enemy.atk, attackerUnit.statusEffects ?? [], 'attack'),
    skillMultiplier: skillMult,
    critical: crit,
    targetDefense: applyLegacyStatusStatModifiers(target.def ?? 5, target.statusEffects ?? [], 'defense'),
    groupDefenseBonus: groupBuffBonusesForSide(state, target.isHero ? 'hero' : 'enemy').def,
    groupAttackBonus: groupBuffBonusesForSide(state, attackerUnit.isHero ? 'hero' : 'enemy').atk,
    damageType: dt,
    resistances: target.resistances,
  }).finalDamage
}

function computeEnemyHitValues(fResult: { base: number; diceTotal: number } | null, adjAttack: number, enemy: EnemyData, defVal: number, random: RandomSource = { next: () => Math.random() }): { hit: boolean; rollBase: number; rollDice: number; attackTotal: number } {
  if (fResult) {
    const rollBase = fResult.base
    const rollDice = fResult.diceTotal
    const attackTotal = adjAttack
    return { hit: resolveAttackHit({ attackTotal, defenseValue: defVal ?? 5 }).hit, rollBase, rollDice, attackTotal }
  }
  const rollBase = Math.round(enemy.atk)
  const rollDice = randomIntInclusive(random, 1, 10)
  const attackTotal = rollBase + rollDice
  return { hit: (defVal ?? 10) <= attackTotal, rollBase, rollDice, attackTotal }
}

function applyManaShieldAbsorption(target: CombatUnit, state: CombatState, dmg: number, ctx: CombatCtx): { absorbed: number; finalDmg: number } {
  const result = resolveManaShield({
    enabled: state.manaShield ?? false,
    currentMp: target.mp,
    incomingDamage: dmg,
  })
  if (result.mpRemaining !== target.mp) {
    target.mp = result.mpRemaining
    emitUnitStateChanged(ctx, target, { mp: target.mp })
  }
  if (result.absorbed > 0) {
    addLog(ctx.log, 'buff', ctx.round, ctx.level, 'combat',
      `🛡️ Escudo de maná absorbe ${result.absorbed} daño`, { actor: target.name, value: result.absorbed })
  }
  return { absorbed: result.absorbed, finalDmg: result.remainingDamage }
}

function applyThornsReflect(target: CombatUnit, enemyUnit: CombatUnit, finalDmg: number, ctx: CombatCtx, heroUnits: CombatUnit[], enemyUnits: CombatUnit[]): void {
  const reflected = calculateThornsDamage({
    enabled: !!target.thornsPct,
    incomingDamage: finalDmg,
    reflectionPercent: target.thornsPct ?? 0,
    attackerAlive: enemyUnit.hp > 0,
  })
  if (reflected <= 0) return
  applyDamageWithEvent(enemyUnit, reflected, target.id, ctx)
  enemyUnit.condition = getCondition(enemyUnit.hp, enemyUnit.maxHp)
  addLog(ctx.log, 'hit', ctx.round, ctx.level, 'combat',
    `🌵 ${target.name} refleja ${reflected} daño a ${enemyUnit.name}`,
    { target: enemyUnit.name, value: reflected })
  if (enemyUnit.hp <= 0) processUnitDefeat(enemyUnit, target, heroUnits, enemyUnits, ctx)
}

function applyCounterAttack(target: CombatUnit, enemyUnit: CombatUnit, finalDmg: number, aCat: string, ctx: CombatCtx, heroUnits: CombatUnit[], enemyUnits: CombatUnit[]): void {
  if (!target.counterPct || finalDmg <= 0 || target.hp <= 0 || enemyUnit.hp <= 0 || aCat !== 'melee') return
  const countered = Math.max(1, Math.round(finalDmg * target.counterPct / 100))
  applyDamageWithEvent(enemyUnit, countered, target.id, ctx)
  enemyUnit.condition = getCondition(enemyUnit.hp, enemyUnit.maxHp)
  addLog(ctx.log, 'hit', ctx.round, ctx.level, 'combat',
    `🔄 ${target.name} contraataca causando ${countered} de daño`,
    { target: enemyUnit.name, value: countered })
  if (enemyUnit.hp <= 0) processUnitDefeat(enemyUnit, target, heroUnits, enemyUnits, ctx)
}

function executeEnemyAction(
  enemy: EnemyData,
  enemyUnit: CombatUnit,
  heroUnits: CombatUnit[],
  ctx: CombatCtx,
  initiative: number,
  actionNum: number,
  totalActions: number
): DetailedAction | null {
  const state = ctx.state!
  const lvl = enemy.level
  const enemyAttrs = {
    atk: enemy.atk, def: enemy.def, dx: enemy.dx, ag: enemy.ag, level: lvl,
    st: Math.round(lvl * 2 + enemy.dx * 0.5),
    co: Math.round((enemy.hp ?? 50) / 10),
    in: Math.round(lvl * 1.5 + enemy.dx * 0.3),
    ch: Math.round(lvl * 0.8),
    pe: Math.round(enemy.dx * 0.5 + enemy.ag * 0.5),
    wi: Math.round(lvl * 1.2 + enemy.def * 0.3),
    ...(enemy.attrs ?? {}),
  }

  let chosenSkill = pickEnemySkill(enemy, enemyUnit, state, ctx.round)
  if (chosenSkill && !isSupportedSkillEffect(chosenSkill.effect)) {
    addLog(ctx.log, 'tactic_eval', ctx.round, ctx.level, 'combat',
      `${enemyUnit.name} omite ${chosenSkill.name ?? 'una habilidad'}: efecto "${chosenSkill.effect}" no implementado; ejecuta su ataque básico.`,
      { actor: enemyUnit.name, skill: chosenSkill.name ?? `skill_${chosenSkill.skillId}` })
    chosenSkill = null
  }
  const skillName = chosenSkill?.name ?? enemy.skillName ?? 'Ataque'
  const damageType = (chosenSkill?.damageType ?? enemy.damageType ?? 'physical') as DamageType

  if (chosenSkill) {
    applySkillCooldown(state, enemyUnit, null, chosenSkill.skillId, chosenSkill.cooldownRounds ?? 0, ctx)
  }

  const executionSkill = chosenSkill
    ? {
        skillId: chosenSkill.skillId,
        name: chosenSkill.name,
        effect: chosenSkill.effect,
        multiplier: chosenSkill.multiplier,
        rank: 0,
        healPct: chosenSkill.effect === 'heal' ? ((chosenSkill.formula as any)?.healPct ?? 30) : undefined,
        healTarget: 'self' as const,
      }
    : { skillId: enemy.id, effect: 'attack' }
  const enemyAction = {
    targetPos: 'auto' as const,
    targetType: enemy.ai?.type === 'weakest'
      ? 'weakest' as const
      : enemy.ai?.type === 'strongest'
        ? 'strongest' as const
        : 'enemy_ai' as const,
    globalTargeting: true,
  }
  const executionInput = {
    skill: executionSkill,
    actor: enemyUnit,
    allies: state.enemies.filter(unit => unit.id !== enemyUnit.id && unit.hp > 0),
    enemies: heroUnits,
    action: enemyAction,
    random: ctx.random,
  }

  if (chosenSkill?.effect === 'heal') {
    const plan = resolveSkillExecution(executionInput)
    if (plan.kind === 'heal' && plan.target) {
      const result = executeEnemyHealEffect(enemy, enemyUnit, plan.target, chosenSkill, skillName, plan.healPct, ctx, { initiative, actionNum, totalActions })
      if (result) return result
    }
  }
  if (chosenSkill?.effect === 'party_attack_up' || chosenSkill?.effect === 'defense_up') {
    const plan = resolveSkillExecution(executionInput)
    if (plan.kind === 'party_buff') {
      return executeEnemyBuffEffect(enemy, enemyUnit, chosenSkill, skillName, plan.buff, plan.bonus, ctx, { initiative, actionNum, totalActions })
    }
  }

  // Preserve legacy order: formula dice are rolled before target selection.
  const formula = chosenSkill?.formula
  const fResult = formula ? evaluateFormula(formula, enemyAttrs, 1, ctx.random) : null
  const adjAttack = fResult ? applyDiceMultiplier(fResult.base, fResult.diceTotal, formula?.diceCount ?? 0, formula?.diceSides ?? 0, formula?.diceDivisor) : 0
  const plan = resolveSkillExecution(executionInput)

  const singlePlan = plan.kind === 'area_attack' && !fResult
    ? resolveSkillExecution({
        ...executionInput,
        skill: { ...executionSkill, effect: 'attack' },
      })
    : plan
  return dispatchSkillExecutionPlan<CombatUnit, DetailedAction | null>(singlePlan, {
    heal: () => null,
    party_buff: () => null,
    area_attack: targets => fResult
      ? executeEnemyAoeAttack(enemy, enemyUnit, heroUnits, { chosenSkill, skillName }, { fResult, adjAttack, isArmorPen: false }, ctx, { initiative, actionNum, totalActions }, targets)
      : null,
    single_attack: (target, armorPenetration) => {
      if (!target) return null
      const aCat = inferAttackCategory(chosenSkill ?? undefined, enemy.position)
      return executeEnemySingleTargetAttack(enemy, enemyUnit, heroUnits, chosenSkill, skillName, damageType, fResult, adjAttack, armorPenetration, target, state, ctx, initiative, actionNum, totalActions, aCat)
    },
    unsupported: () => null,
  })
}

// ─── EFECTOS DE ESTADO ────────────────────────────────────────────────────────

function applyStatusEffect(
  target: CombatUnit, type: StatusEffect['type'], value: number, rounds: number,
  sourceName: string, ctx: CombatCtx
) {
  const incoming: StatusEffect = { type, remainingRounds: rounds, value, source: sourceName, sourceName }
  target.statusEffects = [...applyLegacyStatusEffect(target.statusEffects ?? [], incoming)]
  emitUnitStateChanged(ctx, target, { statusEffects: target.statusEffects.map(effect => ({ ...effect })) })
  const icon = statusIcon(type)
  addLog(ctx.log, 'condition_change', ctx.round, ctx.level, 'combat',
    `${icon} ${target.name} sufre ${type} (${rounds}r, ${value}/ronda)`,
    { actor: sourceName, target: target.name, value })
}

function processDotDamage(
  unit: CombatUnit, unitName: string,
  log: LogEntry[], round: number, level: number,
  heroUnits: CombatUnit[], enemyUnits: CombatUnit[], ctx: CombatCtx
): number {
  if (!unit.statusEffects || unit.hp <= 0) return 0
  const doT = calculateLegacyStatusDamage(unit.statusEffects)
  if (doT <= 0) return 0

  const appliedDamage = applyDamageWithEvent(unit, doT, `status:${unit.id}`, ctx)
  unit.condition = getCondition(unit.hp, unit.maxHp)
  if (appliedDamage > 0) {
    ctx.state!.damagedThisRound = true
    processPassiveEffects('on_damage', unit, heroUnits, enemyUnits, undefined, ctx)
    addLog(log, 'hit', round, level, 'combat',
      `☠️ ${unitName} recibe ${appliedDamage} daño de efectos`,
      { target: unitName, value: appliedDamage })
  }
  if (unit.hp <= 0) {
    processUnitDefeat(unit, undefined, heroUnits, enemyUnits, ctx, `💀 ${unitName} derribado por efectos`)
  }
  return appliedDamage
}

function isUnitStunned(unit: CombatUnit): boolean {
  return isLegacyCombatUnitDisabled(unit.statusEffects ?? [])
}

function decayPeriodicStatusEffects(unit: CombatUnit, ctx: CombatCtx) {
  if (!unit.statusEffects) return
  unit.statusEffects = [...advanceLegacyPeriodicStatusRound(unit.statusEffects)]
  emitUnitStateChanged(ctx, unit, { statusEffects: unit.statusEffects.map(effect => ({ ...effect })) })
}

function decayStatusEffects(unit: CombatUnit, ctx: CombatCtx) {
  if (!unit.statusEffects) return
  unit.statusEffects = [...advanceLegacyNonPeriodicStatusRound(unit.statusEffects)]
  emitUnitStateChanged(ctx, unit, { statusEffects: unit.statusEffects.map(effect => ({ ...effect })) })
}


const BUFF_DURATION = 3  // rondas que duran los buffs de party_attack_up / defense_up

function groupBuffBonusesForSide(state: CombatState, side: 'hero' | 'enemy'): { atk: number; def: number } {
  const sideBuffBonuses = calculateLegacyGroupBuffBonuses(state.buffs ?? [], side)
  // Hero loadout/clan bonuses belong to the hero side; faction bonuses belong
  // to enemies. Neither side may inherit the opposing side's temporary buffs.
  if (side === 'hero') {
    const allBuffBonuses = calculateLegacyGroupBuffBonuses(state.buffs ?? [])
    const baseAtk = state.baseGroupAtkBonus ?? (state.groupAtkBonus - allBuffBonuses.atk - (state.factionBonuses?.atk ?? 0))
    const baseDef = state.baseGroupDefBonus ?? (state.groupDefBonus - allBuffBonuses.def - (state.factionBonuses?.def ?? 0))
    return { atk: baseAtk + sideBuffBonuses.atk, def: baseDef + sideBuffBonuses.def }
  }
  return {
    atk: (state.factionBonuses?.atk ?? 0) + sideBuffBonuses.atk,
    def: (state.factionBonuses?.def ?? 0) + sideBuffBonuses.def,
  }
}

function recalcGroupBuffs(state: CombatState) {
  if (!state.buffs) state.buffs = []
  const bonuses = calculateLegacyGroupBuffBonuses(state.buffs)
  state.groupAtkBonus = (state.baseGroupAtkBonus ?? 0) + bonuses.atk + (state.factionBonuses?.atk ?? 0)
  state.groupDefBonus = (state.baseGroupDefBonus ?? 0) + bonuses.def + (state.factionBonuses?.def ?? 0)
}

function addBuff(state: CombatState, type: 'atk' | 'def', value: number, sourceName: string, side: 'hero' | 'enemy', duration: number | null, ctx?: CombatCtx) {
  state.buffs = [...applyLegacyCombatBuff(state.buffs ?? [], { type, value, sourceName, side, remainingRounds: duration })]
  recalcGroupBuffs(state)
  if (ctx) emitCombatStateChanged(ctx, { buffs: state.buffs.map(buff => ({ ...buff })) })
}

function decayBuffs(state: CombatState, ctx?: CombatCtx) {
  if (!state.buffs) return
  state.buffs = [...advanceLegacyCombatBuffs(state.buffs)]
  recalcGroupBuffs(state)
  if (ctx) emitCombatStateChanged(ctx, { buffs: state.buffs.map(buff => ({ ...buff })) })
}

function buildNaturalResistances(faction?: string): Partial<Record<DamageType, number>> {
  const r: Partial<Record<DamageType, number>> = {}
  switch (faction) {
    case 'slime': r.physical = 15; break
    case 'undead': r.dark = 20; r.holy = -20; break
    case 'demon': r.fire = 20; break
    case 'elemental': r.fire = 30; r.ice = 30; break
    case 'dragon': r.physical = 10; r.fire = 10; r.ice = 10; break
    case 'plant': r.poison = 30; break
    case 'goblin': r.psychological = 15; break
  }
  return r
}


function applyCritEffects(
  isCrit: boolean,
  target: CombatUnit,
  damage: number,
  ctx: CombatCtx,
  sourceName: string,
) {
  if (!isCrit || damage <= 0 || target.hp <= 0) return
  const bleedDmg = Math.max(1, Math.round(damage * 0.2))
  applyStatusEffect(target, 'bleed', bleedDmg, 2, sourceName, ctx)
  if (nextRandom(ctx.random ?? { next: () => Math.random() }) < 0.15) {
    applyStatusEffect(target, 'stun', 0, 1, sourceName, ctx)
  }
}

function applyVampireHeal(
  source: CombatUnit,
  damage: number,
  ctx: CombatCtx,
) {
  if (!source.vampirePct || damage <= 0 || source.hp <= 0) return
  const healed = Math.min(source.maxHp - source.hp, Math.max(1, Math.round(damage * source.vampirePct / 100)))
  if (healed <= 0) return
  applyHealingWithEvent(source, healed, source.id, ctx)
  source.condition = getCondition(source.hp, source.maxHp)
  addLog(ctx.log, 'heal', ctx.round, ctx.level, 'combat',
    `🩸 ${source.name} absorbe ${healed} HP (vampirismo)`,
    { target: source.name, value: healed })
}

function processDamagePassive(pe: PassiveEffect, value: number, source: CombatUnit, heroUnits: CombatUnit[], enemyUnits: CombatUnit[], attacker: CombatUnit | undefined, ctx: CombatCtx): void {
  if (pe.targetType === 'attacker' && attacker) {
    damageUnit(attacker, value, source, `🗜️ ${source.name} hiere a ${attacker.name} por ${value} de ${pe.damageType ?? 'physical'}`, ctx, heroUnits, enemyUnits)
    return
  }
  if (pe.targetType === 'all_heroes') {
    damageAll(heroUnits, value, source, `💥 ${source.name} explota causando ${value} de ${pe.damageType ?? 'fire'} a todos los héroes`, ctx, heroUnits, enemyUnits)
    return
  }
  if (pe.targetType === 'all_enemies') {
    damageAll(enemyUnits, value, source, '', ctx, heroUnits, enemyUnits)
    return
  }
  if (pe.targetType === 'self') {
    damageUnit(source, value, source, '', ctx, heroUnits, enemyUnits)
  }
}

function damageAll(units: CombatUnit[], value: number, source: CombatUnit, logMsg: string, ctx: CombatCtx, heroUnits: CombatUnit[], enemyUnits: CombatUnit[]): void {
  for (const u of units) {
    if (u.hp <= 0) continue
    applyDamageWithEvent(u, value, source.id, ctx)
    u.condition = getCondition(u.hp, u.maxHp)
    if (u.hp <= 0) processUnitDefeat(u, source, heroUnits, enemyUnits, ctx)
  }
  if (logMsg) addLog(ctx.log, 'hit', ctx.round, ctx.level, 'combat', logMsg, { target: source.name, value })
}

function damageUnit(unit: CombatUnit, value: number, source: CombatUnit, logMsg: string, ctx: CombatCtx, heroUnits: CombatUnit[], enemyUnits: CombatUnit[]): void {
  applyDamageWithEvent(unit, value, source.id, ctx)
  if (unit.condition) unit.condition = getCondition(unit.hp, unit.maxHp)
  if (logMsg) addLog(ctx.log, 'hit', ctx.round, ctx.level, 'combat', logMsg, { target: unit.name, value })
  if (unit.hp <= 0) processUnitDefeat(unit, source, heroUnits, enemyUnits, ctx)
}

function doPassiveHeal(u: CombatUnit, value: number, source: CombatUnit, pe: PassiveEffect, ctx: CombatCtx): void {
  if (u.hp <= 0) return
  const actual = Math.min(value, u.maxHp - u.hp)
  if (actual <= 0) return
  applyHealingWithEvent(u, actual, source.id, ctx)
  u.condition = getCondition(u.hp, u.maxHp)
  addLog(ctx.log, 'heal', ctx.round, ctx.level, 'combat',
    `💚 ${source.name} recupera ${actual} HP (${pe.sourceName})`,
    { target: u.name, value: actual })
}

function processHealPassive(pe: PassiveEffect, value: number, source: CombatUnit, heroUnits: CombatUnit[], enemyUnits: CombatUnit[], attacker: CombatUnit | undefined, ctx: CombatCtx): void {
  if (pe.targetType === 'self') doPassiveHeal(source, value, source, pe, ctx)
  if (pe.targetType === 'all_heroes') heroUnits.forEach(u => doPassiveHeal(u, value, source, pe, ctx))
  if (pe.targetType === 'all_enemies') enemyUnits.forEach(u => doPassiveHeal(u, value, source, pe, ctx))
  if (pe.targetType === 'attacker' && attacker) doPassiveHeal(attacker, value, source, pe, ctx)
}

function resolvePassiveTargets(pe: PassiveEffect, source: CombatUnit, heroUnits: CombatUnit[], enemyUnits: CombatUnit[]): CombatUnit[] {
  if (pe.targetType === 'all_heroes') return heroUnits
  if (pe.targetType === 'all_enemies') return enemyUnits
  if (pe.targetType === 'self') return [source]
  return []
}

function processBuffPassive(pe: PassiveEffect, value: number, source: CombatUnit, heroUnits: CombatUnit[], enemyUnits: CombatUnit[], ctx: CombatCtx): void {
  if (!ctx?.state) return
  const buffType = pe.buffType ?? 'atk'
  const targets = resolvePassiveTargets(pe, source, heroUnits, enemyUnits)
  for (const t of targets) {
    addBuff(ctx.state, buffType, value, `${source.name}:${pe.sourceName}`, t.isHero ? 'hero' : 'enemy', 2, ctx)
  }
  if (targets.length > 0) {
    addLog(ctx.log, 'buff', ctx.round, ctx.level, 'combat',
      `✨ ${source.name} activa ${pe.sourceName}: +${value}% ${buffType.toUpperCase()} (${targetLabel(pe.targetType, source.name)})`,
      { actor: source.name, value })
  }
}

function processPassiveEffects(
  trigger: PassiveEffect['trigger'],
  source: CombatUnit,
  heroUnits: CombatUnit[],
  enemyUnits: CombatUnit[],
  attacker?: CombatUnit,
  ctx?: CombatCtx,
): void {
  const event: CombatEvent = trigger === 'on_round_start'
    ? { type: trigger, unitId: source.id, round: ctx?.round ?? 0 }
    : trigger === 'on_death'
      ? { type: trigger, sourceId: attacker?.id ?? source.id, targetId: source.id, ...(attacker ? { attackerId: attacker.id } : {}) }
      : { type: trigger, sourceId: attacker?.id ?? source.id, targetId: source.id, ...(attacker ? { attackerId: attacker.id } : {}) }

  // Damage observers are notified at the exact HP mutation site with effective damage.
  // Keep the legacy passive trigger dispatch below, but avoid emitting a second observer event.
  if (trigger !== 'on_damage' && ctx) dispatchCombatEvent(ctx, event)

  const handler: CombatEventHandler = {
    eventType: trigger,
    handle: () => {
      const commands = resolveLegacyPassiveEffects(trigger, {
        id: source.id,
        name: source.name,
        attrs: source.attrs,
        passiveEffects: source.passiveEffects,
      })
      for (const command of commands) {
        const plan = planPassiveExecution(command, {
          sourceId: source.id,
          ...(attacker ? { attackerId: attacker.id } : {}),
          heroIds: heroUnits.map(unit => unit.id),
          enemyIds: enemyUnits.map(unit => unit.id),
        })
        if (plan.targetIds.length === 0) continue
        const passive: PassiveEffect = {
          trigger: command.trigger,
          effectType: command.effectType,
          targetType: command.targetType,
          value: command.value,
          sourceName: command.sourceName,
          ...(command.damageType ? { damageType: command.damageType } : {}),
          ...(command.buffType ? { buffType: command.buffType } : {}),
        }
        if (command.effectType === 'damage') {
          processDamagePassive(passive, command.value, source, heroUnits, enemyUnits, attacker, ctx!)
        } else if (command.effectType === 'heal') {
          processHealPassive(passive, command.value, source, heroUnits, enemyUnits, attacker, ctx!)
        } else if (command.effectType === 'buff') {
          processBuffPassive(passive, command.value, source, heroUnits, enemyUnits, ctx!)
        }
      }
    },
  }
  new CombatEventDispatcher([handler]).dispatch(event)
}

/** Processes a unit's transition to defeated exactly once per combat context. */
function processUnitDefeat(
  unit: CombatUnit,
  attacker: CombatUnit | undefined,
  heroUnits: CombatUnit[],
  enemyUnits: CombatUnit[],
  ctx: CombatCtx,
  message = `💀 ${unit.name} derribado`,
): boolean {
  if (unit.hp > 0) return false
  const processed = ctx.processedDeaths ?? (ctx.processedDeaths = new Set<string>())
  if (!markUnitDefeated(processed, unit.id, unit.hp <= 0)) return false
  unit.condition = getCondition(unit.hp, unit.maxHp)
  emitUnitStateChanged(ctx, unit, { condition: unit.condition, defeated: true })
  addLog(ctx.log, 'death', ctx.round, ctx.level, 'combat', message, { target: unit.name, targetId: unit.id })
  processPassiveEffects('on_death', unit, heroUnits, enemyUnits, attacker, ctx)
  return true
}

// ─── NARRATIVA ────────────────────────────────────────────────────────────────

function generateRoundNarrative(round: number, actions: DetailedAction[]): string {
  if (actions.length === 0) return `Ronda ${round} — sin acciones`
  const counts = countRoundActionTypes(actions)
  const suffix = buildRoundHighlights(counts)
  const mood = pickRoundMood(counts, actions.length)
  return `Ronda ${round} — ${mood}${suffix}`
}

interface RoundActionCounts {
  atkCount: number; healCount: number; failCount: number
  critCount: number; dodgeCount: number; barrierCount: number; deathCount: number
}

function countRoundActionTypes(actions: DetailedAction[]): RoundActionCounts {
  let atkCount = 0, healCount = 0, failCount = 0, critCount = 0
  let dodgeCount = 0, barrierCount = 0, deathCount = 0
  for (const a of actions) {
    if (a.damageBreakdown && a.damageBreakdown.length > 0) atkCount++
    if (a.healAmount != null) healCount++
    if (a.resultType === 'failed' && !a.healAmount && !a.buffName && !a.itemName) failCount++
    if (a.resultType === 'critical_success') critCount++
    if (a.defenseEffect === 'dodge' || a.targetResults?.some(t => t.defenseEffect === 'dodge')) dodgeCount++
    if ((a.absorbed ?? 0) > 0 || a.targetResults?.some(t => (t.absorbed ?? 0) > 0)) barrierCount++
    if (a.message?.includes('DERRIBADO')) deathCount++
  }
  return { atkCount, healCount, failCount, critCount, dodgeCount, barrierCount, deathCount }
}

function buildRoundHighlights(c: RoundActionCounts): string {
  const highlights: string[] = []
  if (c.critCount >= 2) highlights.push(`${c.critCount} críticos`)
  if (c.deathCount > 0) highlights.push(`${c.deathCount} caídos`)
  if (c.dodgeCount > 0) highlights.push(`${c.dodgeCount} evasiones`)
  if (c.barrierCount > 0) highlights.push(`${c.barrierCount} barreras`)
  if (c.healCount >= 2) highlights.push(`${c.healCount} curas`)
  return highlights.length > 0 ? ` — ${highlights.join(', ')}` : ''
}

function pickRoundMood(c: RoundActionCounts, total: number): string {
  const atkPct = c.atkCount / total
  const healPct = c.healCount / total
  const failPct = c.failCount / total
  if (c.critCount >= 2) return '★ Críticos devastadores'
  if (c.deathCount > 0 && atkPct >= 0.5) return 'Baño de sangre'
  if (c.dodgeCount >= 2) return 'Danza de sombras'
  if (atkPct >= 0.7 && failPct <= 0.1) return 'Brutal asalto'
  if (atkPct >= 0.5 && healPct >= 0.2) return 'Ataque y respuesta'
  if (healPct >= 0.4) return 'Ronda defensiva'
  if (failPct >= 0.4) return 'Intercambio errático'
  if (atkPct >= 0.5 && failPct >= 0.25) return 'Caos y metralla'
  return 'Cruce de golpes'
}

function allHeroesDead(heroUnits: CombatUnit[]): boolean {
  return heroUnits.every(h => h.hp <= 0)
}

function anyHeroAlive(heroUnits: CombatUnit[]): boolean {
  return heroUnits.some(h => h.hp > 0)
}

interface FactionBonusConfig {
  faction: string
  min: number
  atk?: number
  def?: number
  combustion?: boolean
  darknessHeal?: boolean
  log: string
}

const FACTION_BONUSES: FactionBonusConfig[] = [
  { faction: 'undead', min: 3, atk: 15, def: 10, log: '💀 Sindicato de no-muertos: +15% ATK / +10 DEF grupal' },
  { faction: 'arachnid', min: 2, atk: 50, log: '🕷️ Esencia arácnida: +50% ATK grupal' },
  { faction: 'fire', min: 2, combustion: true, log: '🔥 Sello ígneo: ataques de fuego aplican quemadura' },
  { faction: 'darkness', min: 2, darknessHeal: true, log: '🌑 Sombra vital: los aliados de oscuridad recuperan 8% HP por ronda' },
  { faction: 'elemental', min: 2, def: 50, log: '🧱 Coraza elemental: +50% DEF grupal' },
  { faction: 'goblin', min: 3, atk: 25, log: '👺 Horda goblin: +25% ATK grupal' },
  { faction: 'slime', min: 2, def: 20, log: '🟢 Masa viscosa: +20% DEF grupal' },
  { faction: 'trap', min: 2, atk: 20, log: '🗜️ Mecanismo letal: +20% ATK grupal' },
]

function applyFactionBonuses(enemyUnits: CombatUnit[], state: CombatState, log: LogEntry[], levelNum: number): void {
  const fb = state.factionBonuses!
  state.groupAtkBonus -= fb.atk
  state.groupDefBonus -= fb.def
  fb.atk = 0; fb.def = 0; fb.combustion = false; fb.darknessHeal = false

  const factions: Record<string, number> = {}
  for (const u of enemyUnits) {
    if (u.hp > 0 && u.faction) factions[u.faction] = (factions[u.faction] ?? 0) + 1
  }

  for (const cfg of FACTION_BONUSES) {
    if ((factions[cfg.faction] ?? 0) < cfg.min) continue
    if (cfg.atk) { fb.atk += cfg.atk; state.groupAtkBonus += cfg.atk }
    if (cfg.def) { fb.def += cfg.def; state.groupDefBonus += cfg.def }
    if (cfg.combustion) fb.combustion = true
    if (cfg.darknessHeal) fb.darknessHeal = true
    addLog(log, 'buff', state.round, levelNum, 'combat', cfg.log)
  }
}

function applyClanBonuses(heroes: HeroData[], clan: Record<string, number>): void {
  if (!clan.all_stats_pct) return
  for (const hero of heroes) {
    for (const k of Object.keys(hero.attrs)) {
      hero.attrs[k] = Math.round(hero.attrs[k] * (1 + clan.all_stats_pct / 100))
    }
    hero.hpMax = Math.round(hero.hpMax * (1 + clan.all_stats_pct / 100))
    hero.mpMax = Math.round(hero.mpMax * (1 + clan.all_stats_pct / 100))
  }
}

function scaleEnemiesToParty(dungeon: DungeonData, heroes: HeroData[]): void {
  if (dungeon.recommendedLevel == null || dungeon.difficulty == null) return
  const heroCount = heroes.length
  const avgLevel = heroes.reduce((sum, h) => sum + h.level, 0) / heroCount
  const baselineTotal = dungeon.recommendedLevel * 5
  const actualTotal = avgLevel * heroCount
  const effectiveLevel = actualTotal > 0 && baselineTotal > 0
    ? dungeon.recommendedLevel * (actualTotal / baselineTotal)
    : dungeon.recommendedLevel
  const difficultyMod = Math.max(0.5, 1 + (dungeon.difficulty - 3) * 0.15)
  for (const lvl of dungeon.levels) {
    lvl.enemies = lvl.enemies.map(e => scaleEnemy(e, effectiveLevel, difficultyMod, dungeon.growthFactor))
  }
}

function resolveCooldownOverride(hero: HeroData, action: TacticAction, state: CombatState, actorUnit: CombatUnit, log: LogEntry[], round: number, levelNum: number): TacticAction {
  const heroCooldowns = state.skillCooldowns?.[actorUnit.id] ?? {}
  if (!isSkillOnCooldown(state.skillCooldowns, actorUnit.id, action.skillId)) return action
  const available = hero.skills.find(s => !heroCooldowns[s.skillId] && (isBasicSkill(s)))
  if (!available) return action
  const override: TacticAction = { ...action, skillId: available.skillId, fallbackReason: 'cooldown', selectedSkillId: action.skillId }
  addLog(log, 'tactic_eval', round, levelNum, 'combat',
    `⏳ ${actorUnit.name} — skill_${action.skillId} en cooldown, usando skill_${available.skillId}`,
    { actor: actorUnit.name, skill: `skill_${available.skillId}` })
  return override
}

function resolveBuffOverride(hero: HeroData, action: TacticAction, state: CombatState, actorUnit: CombatUnit, log: LogEntry[], round: number, levelNum: number): TacticAction {
  const chosenBuffSkill = hero.skills.find(s => s.skillId === action.skillId)
  if (!chosenBuffSkill || (chosenBuffSkill.effect !== 'party_attack_up' && chosenBuffSkill.effect !== 'defense_up')) return action
  const isAtk = chosenBuffSkill.effect === 'party_attack_up'
  const buffType = isAtk ? 'atk' : 'def'
  const currentBuffs = (state.buffs ?? []).filter(buff =>
    buff.side === 'hero' && buff.type === buffType &&
    (buff.remainingRounds === null || buff.remainingRounds > 0)
  )
  const currentBuffValue = currentBuffs.reduce((maximum, buff) => Math.max(maximum, buff.value), 0)
  if (currentBuffValue <= 0) return action

  const selectedBuffValue = calculatePartyBuffBonus(chosenBuffSkill.effect, chosenBuffSkill.multiplier, chosenBuffSkill.rank)
  // A stronger buff, or an equal/stronger buff that expires sooner, is still useful.
  // The stacking adapter preserves the strongest value and extends finite duration.
  const existingCoversDuration = currentBuffs.some(buff =>
    buff.value >= selectedBuffValue &&
    (buff.remainingRounds === null || buff.remainingRounds >= BUFF_DURATION)
  )
  if (selectedBuffValue > currentBuffValue || !existingCoversDuration) return action

  const ataque = hero.skills.find(s => isBasicSkill(s))
  if (!ataque) return action
  const override: TacticAction = { ...action, skillId: ataque.skillId, fallbackReason: 'buff_active', selectedSkillId: action.skillId }
  addLog(log, 'tactic_eval', round, levelNum, 'combat',
    `⏭️ ${actorUnit.name} — ${chosenBuffSkill.name ?? 'buff'} ya activo, usando ${ataque.name ?? 'Ataque básico'}`,
    { actor: actorUnit.name, skill: `skill_${ataque.skillId}` })
  return override
}

function applySkillCooldown(state: CombatState, actorUnit: CombatUnit, hero: HeroData | null, skillId: number, cooldownOverride?: number, ctx?: CombatCtx): void {
  let cd = cooldownOverride
  if (cd === undefined && hero) {
    const skillObj = getSkill(hero, skillId)
    cd = skillObj.cooldownRounds
  }
  cd = normalizeSkillCooldown(cd)
  if (cd <= 0) return
  state.skillCooldowns = setSkillCooldown(state.skillCooldowns, actorUnit.id, skillId, cd)
  if (ctx) emitCombatStateChanged(ctx, { cooldowns: state.skillCooldowns })
}

function decaySkillCooldowns(state: CombatState, ctx?: CombatCtx): void {
  state.skillCooldowns = advanceSkillCooldowns(state.skillCooldowns)
  if (ctx) emitCombatStateChanged(ctx, { cooldowns: state.skillCooldowns })
}

function applyDarknessHeal(enemyUnits: CombatUnit[], state: CombatState, log: LogEntry[], round: number, levelNum: number, ctx: CombatCtx): void {
  if (!state.factionBonuses?.darknessHeal) return
  for (const u of enemyUnits) {
    if (u.hp > 0 && u.faction === 'darkness') {
      const healed = Math.max(1, Math.round(u.maxHp * 0.08))
      applyHealingWithEvent(u, healed, u.id, ctx)
      addLog(log, 'heal', round, levelNum, 'combat',
        `🌑 ${u.name} recupera ${healed} HP (sombra vital)`,
        { target: u.name, value: healed })
    }
  }
}

function processRoundStartPassives(heroUnits: CombatUnit[], enemyUnits: CombatUnit[], ctx: CombatCtx): void {
  for (const hu of heroUnits) {
    if (hu.hp > 0) processPassiveEffects('on_round_start', hu, heroUnits, enemyUnits, undefined, ctx)
  }
  for (const e of enemyUnits) {
    if (e.hp > 0) processPassiveEffects('on_round_start', e, heroUnits, enemyUnits, undefined, ctx)
  }
}

function applyManaRegen(heroUnits: CombatUnit[], ctx: CombatCtx): void {
  for (const hu of heroUnits) {
    if (hu.hp <= 0) continue
    const regen = 5 + Math.floor(hu.maxMp * 0.02)
    const previousMp = hu.mp
    hu.mp = Math.min(hu.maxMp, hu.mp + regen)
    if (hu.mp !== previousMp) emitUnitStateChanged(ctx, hu, { mp: hu.mp })
  }
}

function processTrapsAutoWin(enemyUnits: CombatUnit[], log: LogEntry[], round: number, levelNum: number, ctx?: CombatCtx): boolean {
  const aliveNonTraps = enemyUnits.filter(e => e.hp > 0 && !e.trap)
  if (aliveNonTraps.length > 0 || !enemyUnits.some(e => e.hp > 0 && e.trap)) return false
  for (const e of enemyUnits) {
    if (!e.trap) continue
    e.hp = 0
    e.condition = getCondition(e.hp, e.maxHp)
    if (ctx) emitUnitStateChanged(ctx, e, { hp: 0, condition: e.condition, defeated: true })
  }
  addLog(log, 'level_complete', round, levelNum, 'combat', '🗜️ Trampas desactivadas — nivel superado')
  return true
}

function computeLevelRewards(lvl: DungeonLevel, dungeon: DungeonData, levelVictory: boolean, options: { firstOfDay?: boolean; groupBonus?: boolean }, clan: Record<string, number>, heroUnits: CombatUnit[]): { lvlEp: number; lvlGold: number } {
  const aliveCount = Math.max(1, heroUnits.filter(h => h.hp > 0).length)
  if (!levelVictory) {
    let lvlEp = Math.round(dungeon.epReward * 0.4 / dungeon.levels.length)
    let lvlGold = Math.round(dungeon.goldReward * 0.4 / dungeon.levels.length)
    if (clan.ep_bonus_pct) lvlEp = Math.round(lvlEp * (1 + clan.ep_bonus_pct / 100))
    if (clan.gold_bonus_pct) lvlGold = Math.round(lvlGold * (1 + clan.gold_bonus_pct / 100))
    return { lvlEp: lvlEp * aliveCount, lvlGold: lvlGold * aliveCount }
  }
  let lvlEp = calcReward(lvl.epReward ?? dungeon.epReward / dungeon.levels.length, { groupBonus: options.groupBonus, victory: true, firstOfDay: lvl.number === 1 && options.firstOfDay })
  let lvlGold = calcReward(lvl.goldReward ?? dungeon.goldReward / dungeon.levels.length, { groupBonus: options.groupBonus, victory: true })
  if (clan.ep_bonus_pct) lvlEp = Math.round(lvlEp * (1 + clan.ep_bonus_pct / 100))
  if (clan.gold_bonus_pct) lvlGold = Math.round(lvlGold * (1 + clan.gold_bonus_pct / 100))
  return { lvlEp: lvlEp * aliveCount, lvlGold: lvlGold * aliveCount }
}

function collectSpecialEvents(heroUnits: CombatUnit[], levelVictory: boolean, roundReports: RoundReport[]): SpecialEvent[] {
  const specialEvents: SpecialEvent[] = []
  const deadHeroes = heroUnits.filter(h => h.hp <= 0)
  for (const h of deadHeroes) {
    specialEvents.push({ type: 'hero_fallen', icon: '💀', description: `${h.name} ha caído en combate` })
  }
  if (!levelVictory) return specialEvents
  const lastRound = roundReports.at(-1)
  if (lastRound) {
    const enemiesBefore = lastRound.stateBefore.enemies.filter(e => e.hp > 0).length
    const enemiesAfter = lastRound.stateAfter.enemies.filter(e => e.hp > 0).length
    if (enemiesBefore > 2 && enemiesAfter === 0) {
      specialEvents.push({ type: 'massacre', icon: '💥', description: 'Todos los enemigos fueron aniquilados en una sola ronda', round: lastRound.roundNumber })
    }
  }
  for (const r of roundReports) {
    for (const h of r.stateAfter.heroes) {
      if (h.hp > 0 && h.hp / h.maxHp <= 0.2 && !deadHeroes.some(dh => dh.id === h.id)) {
        specialEvents.push({ type: 'narrow_escape', icon: '😰', description: `${h.name} escapó por poco de la muerte`, round: r.roundNumber })
        break
      }
    }
    if (specialEvents.some(e => e.type === 'narrow_escape')) break
  }
  return specialEvents
}

function resolveActorUnit(actor: any, heroUnits: CombatUnit[], enemyUnits: CombatUnit[]): (CombatUnit & { attrs?: Record<string, number> }) | undefined {
  return actor.isHero
    ? heroUnits.find(h => h.id === actor.unit.id)
    : enemyUnits.find(e => e.id === actor.unit.id)
}

function runHeroTurn(
  actorUnit: CombatUnit & { attrs: Record<string, number> },
  actor: any, heroes: HeroData[], heroUnits: CombatUnit[], enemyUnits: CombatUnit[],
  state: CombatState, log: LogEntry[], round: number, levelNum: number,
  ai: number, totalActors: number,
  roundActions: DetailedAction[],
  random: RandomSource,
  combatCtx: CombatCtx,
): DetailedAction | null {
  const heroIndex = heroUnits.indexOf(actorUnit)
  const hero = heroes[heroIndex]
  if (!hero) return null

  const perHeroState = buildPerHeroState(actorUnit, heroUnits, enemyUnits, state)
  return executeHeroTurnPipeline({
    selectAction: () => evalTactics(hero.combatProfile.roundRules, perHeroState, getDefaultCombatSkillId(hero.skills)),
    recordSelection: action => addLog(
      log, 'tactic_eval', round, levelNum, 'combat',
      `⚡ Táctica: ${actorUnit.name} → skill_${action.skillId} → ${action.targetType}`,
      { actor: actorUnit.name, skill: `skill_${action.skillId}` }
    ),
    applyCooldownOverride: action => resolveCooldownOverride(hero, action, state, actorUnit, log, round, levelNum),
    applyBuffOverride: action => resolveBuffOverride(hero, action, state, actorUnit, log, round, levelNum),
    execute: finalAction => {
      const result = executeHeroAction(
        actorUnit, hero,
        { action: finalAction, initiative: actor.initiative, actionNum: ai + 1, totalActions: totalActors },
        { ...combatCtx, state: perHeroState },
        { allHeroUnits: heroUnits, allEnemyUnits: enemyUnits }
      )
      if (result) {
        if (finalAction.matchedRulePriority !== undefined) {
          result.tacticRulePriority = finalAction.matchedRulePriority
        }
        if (finalAction.matchedCondition) {
          result.tacticCondition = finalAction.matchedCondition
        }
        if (finalAction.ruleEvaluationTrace?.length) {
          result.tacticRuleEvaluationTrace = finalAction.ruleEvaluationTrace
        }
        if (finalAction.fallbackReason && finalAction.selectedSkillId !== undefined) {
          result.skillFallback = finalAction.fallbackReason
          const selectedSkill = hero.skills.find(skill => skill.skillId === finalAction.selectedSkillId)
          result.selectedSkillName = selectedSkill?.name ?? `skill_${finalAction.selectedSkillId}`
        }
      }
      return result
    },
    afterSuccessfulExecution: finalAction => applySkillCooldown(
      state, actorUnit, hero, finalAction.skillId, undefined, combatCtx
    ),
  })
}

function buildPerHeroState(actorUnit: CombatUnit, heroUnits: CombatUnit[], enemyUnits: CombatUnit[], state: CombatState): CombatState {
  return {
    hero: actorUnit,
    allies: heroUnits.filter(h => h !== actorUnit && h.hp > 0),
    enemies: enemyUnits.filter(e => e.hp > 0),
    round: state.round,
    damagedThisRound: state.damagedThisRound,
    groupAtkBonus: state.groupAtkBonus,
    groupDefBonus: state.groupDefBonus,
    baseGroupAtkBonus: state.baseGroupAtkBonus,
    baseGroupDefBonus: state.baseGroupDefBonus,
    manaShield: state.manaShield ?? false,
    factionBonuses: state.factionBonuses,
    buffs: state.buffs,
  }
}

function runEnemyTurn(
  actorUnit: CombatUnit, lvl: DungeonLevel, heroUnits: CombatUnit[],
  state: CombatState, log: LogEntry[], round: number, levelNum: number,
  ai: number, totalActors: number, random: RandomSource, combatCtx: CombatCtx
): DetailedAction | null {
  return executeEnemyTurnPipeline({
    isAlive: unit => unit.hp > 0,
    resolveDefinition: unit => {
      const enemyIndex = lvl.enemies.findIndex((enemy: any, index: number) => unit.id === `enemy_${enemy.id}_${index}`)
      return enemyIndex < 0 ? undefined : lvl.enemies[enemyIndex]
    },
    execute: (enemyData, unit) => executeEnemyAction(
      enemyData, unit, heroUnits, { ...combatCtx, state }, 0, ai + 1, totalActors
    ),
  }, actorUnit)
}

function cloneHeroForSimulation(hero: HeroData): HeroData {
  return JSON.parse(JSON.stringify(hero)) as HeroData
}

function cloneDungeonForSimulation(dungeon: DungeonData): DungeonData {
  return JSON.parse(JSON.stringify(dungeon)) as DungeonData
}

export async function runDungeon(
  inputHeroes: HeroData[],
  inputDungeon: DungeonData,
  options: { firstOfDay?: boolean; groupBonus?: boolean; clanBonuses?: Record<string, number>; random?: RandomSource; combatEventHandlers?: readonly CombatEventHandler[] } = {}
): Promise<RunResult> {
  // Clone mutable inputs, including nested arrays consumed or transformed during a run.
  const heroes = inputHeroes.map(cloneHeroForSimulation)
  const dungeon = cloneDungeonForSimulation(inputDungeon)
  const random = options.random ?? { next: () => Math.random() }
  const clan = options.clanBonuses ?? {}
  const log: LogEntry[] = []
  const eventRecorder = new CombatEventRecorder()
  const events = new CombatEventDispatcher(options.combatEventHandlers ?? [], 1000, envelope => eventRecorder.record(envelope))
  const eventSequence = { value: 0 }
  const levelResults: RunResult['levelResults'] = []
  let totalRounds = 0
  let epGained = 0
  let goldGained = 0
  let fameGained = 0
  let levelsCleared = 0
  const allLoot: Array<{ itemId: number; qty: number }> = []

  applyClanBonuses(heroes, clan)
  scaleEnemiesToParty(dungeon, heroes)

  // Estado inicial de todos los héroes
  const heroUnits: Array<CombatUnit & { attrs: Record<string, number> }> = heroes.map(h =>
    toUnit(h, h.hpMax, h.mpMax, random)
  )

  // Acumular groupAtkBonus de todos los héroes
  const totalGroupAtkBonus = heroes.reduce((sum, h) => sum + (h.groupAtkBonus ?? 0), 0)

  const levelReports: LevelReport[] = []
  const baseCombatProfiles = heroes.map(hero => hero.combatProfile)
  const baseHeroDefense = heroUnits.map(unit => ({
    defenseValues: { ...(unit.defenseValues ?? {}) },
    defenseSkillNames: { ...(unit.defenseSkillNames ?? {}) },
    defenseEffects: { ...(unit.defenseEffects ?? {}) },
  }))

  for (const lvl of dungeon.levels) {
    heroes.forEach((hero, index) => {
      const unit = heroUnits[index]
      if (unit) applyLevelCombatProfile(hero, unit, baseCombatProfiles[index], lvl.number, baseHeroDefense[index], random)
    })

    addLog(log, 'level_start', 0, lvl.number, 'prelim',
      `━━━ Nivel ${lvl.number} — ${dungeon.name} ━━━`)

    const enemyUnits = lvl.enemies.map((e, i) => enemyToUnit(e, i, random))

    // Usamos el primer héroe como 'hero' en CombatState para compatibilidad
    const firstAlive = heroUnits.find(h => h.hp > 0) ?? heroUnits[0]
    const state: CombatState = {
      hero: firstAlive,
      allies: heroUnits.filter(h => h !== firstAlive && h.hp > 0),
      enemies: enemyUnits,
      round: 0,
      damagedThisRound: false,
      groupAtkBonus: totalGroupAtkBonus + (clan.atk_bonus_pct ?? 0),
      groupDefBonus: clan.def_bonus_pct ?? 0,
      baseGroupAtkBonus: totalGroupAtkBonus + (clan.atk_bonus_pct ?? 0),
      baseGroupDefBonus: clan.def_bonus_pct ?? 0,
      manaShield: heroes.some(h => h.manaShield || h.skills.some(s => s.effect === 'mana_shield')),
      skillCooldowns: {},
      factionBonuses: { atk: 0, def: 0, combustion: false, darknessHeal: false },
      buffs: [],
    }

    // Ronda preliminar para cada héroe vivo
    for (let hi = 0; hi < heroes.length; hi++) {
      const hero = heroes[hi]
      const hu = heroUnits[hi]
      if (hu.hp <= 0) continue
      if (hero.combatProfile.prelimRules.length > 0) {
        runPrelimRound(hu, hero, hero.combatProfile.prelimRules, state, log, lvl.number)
      }
    }

    function applyFactionBonusesWrapper() {
      applyFactionBonuses(enemyUnits, state, log, lvl.number)
    }

    let levelVictory = false
    const MAX_ROUNDS = 30
    const roundReports: RoundReport[] = []
    const processedDeaths = new Set<string>()

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      state.round = round
      state.damagedThisRound = false

      const stateBefore = buildStateSnapshot(heroUnits, enemyUnits, state.buffs, state.groupAtkBonus, state.groupDefBonus, state.factionBonuses)
      const recordRound = (actions: DetailedAction[]) => {
        totalRounds++
        const stateAfter = buildStateSnapshot(heroUnits, enemyUnits, state.buffs, state.groupAtkBonus, state.groupDefBonus, state.factionBonuses)
        roundReports.push({
          roundNumber: round,
          stateBefore,
          stateAfter,
          actions,
          narrative: generateRoundNarrative(round, actions),
        })
      }

      addLog(log, 'round_start', round, lvl.number, 'combat',
        `── Ronda ${round} ──`)

      // Contexto compartido de la ronda: mantiene idempotente el procesamiento de derrotas.
      const roundCtx: CombatCtx = { log, round, level: lvl.number, state, processedDeaths, random, events, eventSequence }
      // A full checkpoint bootstraps reconstruction for this level after all preliminary actions.
      emitCombatStateChanged(roundCtx, {
        level: lvl.number,
        round,
        units: [...heroUnits, ...enemyUnits].map(unit => ({
          id: unit.id,
          hp: unit.hp,
          mp: unit.mp,
          condition: unit.condition,
          defeated: unit.hp <= 0,
          statusEffects: (unit.statusEffects ?? []).map(effect => ({ ...effect })),
        })),
        buffs: (state.buffs ?? []).map(buff => ({ ...buff })),
        cooldowns: state.skillCooldowns ?? {},
      })
      emitCombatStateChanged(roundCtx, { level: lvl.number, round, buffs: state.buffs ?? [], cooldowns: state.skillCooldowns ?? {} })

      // DoT al inicio de ronda; cada tick consume una unidad de duración.
      for (const hu of heroUnits) {
        processDotDamage(hu, hu.name, log, round, lvl.number, heroUnits, enemyUnits, roundCtx)
        decayPeriodicStatusEffects(hu, roundCtx)
      }
      for (const e of enemyUnits) {
        processDotDamage(e, e.name, log, round, lvl.number, heroUnits, enemyUnits, roundCtx)
        decayPeriodicStatusEffects(e, roundCtx)
      }

      applyManaRegen(heroUnits, roundCtx)

      // ─── Bonificaciones de facción ─────────────────
      applyFactionBonusesWrapper()

      applyDarknessHeal(enemyUnits, state, log, round, lvl.number, roundCtx)

      // ─── Pasivos de inicio de ronda ─────────────────
      processRoundStartPassives(heroUnits, enemyUnits, roundCtx)

      const roundStatus = resolveCombatRoundStatus({
        livingHeroCount: heroUnits.filter(hero => hero.hp > 0).length,
        livingEnemyCount: enemyUnits.filter(enemy => enemy.hp > 0).length,
      })
      if (roundStatus === 'heroes_defeated') {
        recordRound([])
        break
      }
      if (roundStatus === 'level_victory') {
        levelVictory = true
        recordRound([])
        break
      }

      if (processTrapsAutoWin(enemyUnits, log, round, lvl.number, roundCtx)) {
        const trapStatus = resolveCombatRoundStatus({
          livingHeroCount: heroUnits.filter(hero => hero.hp > 0).length,
          livingEnemyCount: enemyUnits.filter(enemy => enemy.hp > 0).length,
          trapsAutoWin: true,
        })
        if (trapStatus === 'level_victory') {
          levelVictory = true
          recordRound([])
          break
        }
      }

      const queue = buildTurnQueue(heroUnits, enemyUnits, random)
      const roundActions: DetailedAction[] = []
      const totalActors = queue.length

      executeCombatTurnQueue({
        actors: queue,
        shouldStop: () => allHeroesDead(heroUnits) || enemyUnits.every(enemy => enemy.hp <= 0),
        resolveUnit: actor => resolveActorUnit(actor, heroUnits, enemyUnits),
        isAlive: actorUnit => actorUnit.hp > 0,
        isDisabled: isUnitStunned,
        onDisabled: actorUnit => {
          addLog(log, 'condition_change', round, lvl.number, 'combat',
            `${actorUnit.name} está ${actorUnit.statusEffects?.find(se => se.type === 'stun') ? 'aturdido' : 'congelado'} — salta turno`,
            { target: actorUnit.name })
        },
        execute: (actorUnit, actor, ai, actorCount) => {
          const detail = dispatchCombatActorTurn({
            actor,
            unit: actorUnit,
            actorIndex: ai,
            totalActors: actorCount,
            executeHero: (unit, heroActor, index, total) => runHeroTurn(
              unit as CombatUnit & { attrs: Record<string, number> },
              heroActor, heroes, heroUnits, enemyUnits, state, log, round, lvl.number,
              index, total, roundActions, random, roundCtx
            ),
            executeEnemy: (unit, _enemyActor, index, total) => runEnemyTurn(
              unit, lvl, heroUnits, state, log, round, lvl.number, index, total, random, roundCtx
            ),
          })
          if (detail) roundActions.push(detail)
        },
      })

      // Los buffs duran rondas completas: se consumen después de que ambos bandos actuaron.
      decayBuffs(state, roundCtx)

      // Decaer efectos
      for (const hu of heroUnits) decayStatusEffects(hu, roundCtx)
      for (const e of enemyUnits) decayStatusEffects(e, roundCtx)

      decaySkillCooldowns(state, roundCtx)

      recordRound(roundActions)

      const completedRoundStatus = resolveCombatRoundStatus({
        livingHeroCount: heroUnits.filter(hero => hero.hp > 0).length,
        livingEnemyCount: enemyUnits.filter(enemy => enemy.hp > 0).length,
      })
      if (completedRoundStatus === 'level_victory') {
        levelVictory = true
        break
      }
      if (completedRoundStatus === 'heroes_defeated') break
    }

    levelResults.push({ level: lvl.number, victory: levelVictory, rounds: totalRounds })

    const rewardResult = computeLevelRewards(lvl, dungeon, levelVictory, options, clan, heroUnits)
    const lvlEp = rewardResult.lvlEp
    const lvlGold = rewardResult.lvlGold

    if (levelVictory) {
      levelsCleared++
      addLog(log, 'level_complete', totalRounds, lvl.number, 'combat', `✓ Nivel ${lvl.number} completado`)
      epGained += lvlEp
      goldGained += lvlGold
      fameGained += Math.round(dungeon.fameReward / dungeon.levels.length)
      allLoot.push(...assignLootToHeroes(rollLoot(dungeon.lootTable, random), heroUnits, random))
    } else {
      epGained += lvlEp
      goldGained += lvlGold
      addLog(log, 'defeat', totalRounds, lvl.number, 'combat',
        `⚔️ Derrota en el nivel ${lvl.number}. Sin loot de nivel.`)
    }

    const specialEvents = collectSpecialEvents(heroUnits, levelVictory, roundReports)

    levelReports.push({
      levelNumber: lvl.number,
      victory: levelVictory,
      rounds: roundReports,
      preliminaryLog: log.filter(entry =>
        entry.level === lvl.number && entry.phase === 'prelim' &&
        entry.type !== 'level_start' && entry.type !== 'prelim_start'
      ),
      epGained: lvlEp,
      goldGained: lvlGold,
      locationName: lvl.locationName,
      specialEvents: specialEvents.length > 0 ? specialEvents : undefined,
    })
    if (!levelVictory) break
  }

  const victory = levelsCleared === dungeon.levels.length
  if (victory) {
    addLog(log, 'victory', totalRounds, dungeon.levels.length, 'combat',
      `🏆 ¡${dungeon.name} completado! Victoria total.`)
  }

  return {
    victory,
    levelsCleared,
    totalRounds,
    epGained,
    goldGained,
    fameGained,
    loot: allLoot,
    heroesFinalState: heroUnits.map(h => ({ id: h.id, hp: h.hp, mp: h.mp })),
    consumedConsumables: heroes.flatMap(hero =>
      (hero.consumedConsumableIds ?? []).map(heroItemId => ({ heroId: hero.id, heroItemId }))
    ),
    log,
    levelResults,
    levelReports,
    eventJournal: eventRecorder.snapshot(),
  }
}

