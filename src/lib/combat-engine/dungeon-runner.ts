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
  evalTactics, resolveTarget, buildTurnQueue,
  CombatState, CombatUnit, RoundRule, TacticAction, StatusEffect,
  BuffEntry, PassiveEffect,
} from './tactics-evaluator'

import {
  advanceLegacyStatusRound,
  applyLegacyStatusEffect,
  calculateLegacyStatusDamage,
  isLegacyCombatUnitDisabled,
} from '../../engine/adapters/combat/status-effect-adapter'

import {
  advanceLegacyCombatBuffs,
  applyLegacyCombatBuff,
  calculateLegacyGroupBuffBonuses,
} from '../../engine/adapters/combat/buff-effect-adapter'

import { resolveLegacyPassiveEffects } from '../../engine/adapters/combat/passive-effect-adapter'
import { dispatchCombatEvent, type CombatEvent, type CombatEventHandler } from '../../engine/core/events/combat-events'
import { applyHpDamage, applyHpHealing } from '../../engine/core/combat/health'
import { markUnitDefeated } from '../../engine/core/combat/defeat'
import { resolveIncomingDamage } from '../../engine/core/combat/incoming-damage'
import { resolveAttackHit, resolveCritical } from '../../engine/core/combat/attack-resolution'

// ─── TIPOS DE ENTRADA ─────────────────────────────────────────────────────────

export interface HeroData {
  id: string
  name: string
  level: number
  attrs: Record<string, number>
  hpMax: number
  mpMax: number
  gold: number
  groupAtkBonus?: number
  combatProfile: {
    position: string
    prelimRules: any[]
    roundRules: RoundRule[]
    defenseSkills: Record<string, number | null>
  }
  skills: Array<{ skillId: number; multiplier: number; manaCost: number; healPct?: number; cooldownRounds?: number; effect?: string; rank?: number; formula?: SkillFormula; tags?: string[]; name?: string; icon?: string }>
  equipStats?: Record<string, number>
  consumables?: Array<{ itemId: number; healHp?: number; healMp?: number }>
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
  log: LogEntry[]
  levelResults: Array<{ level: number; victory: boolean; rounds: number }>
  levelReports: LevelReport[]
}

type HeroSkill = {
  skillId: number
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
  processedDeaths?: Set<string>
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
  skill: HeroSkill
  skillName: string
  aCat: string
  atkTotal: number
  adjAttack: number
  isArmorPen: boolean
  isCritAuto: boolean
  formula: SkillFormula | undefined
}

interface EnemyAoeProcessConfig {
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

export function evalDefenseFormula(formula: SkillFormula | undefined | null, attrs: Record<string, number>, rank: number): number {
  if (!formula) return (attrs.dx ?? 5) * 2
  const r = evaluateFormula(formula, attrs, rank)
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

function getDefenseValue(target: CombatUnit, attackCategory: string): { total: number; base: number; dice: number } {
  const base = target.defenseValues?.[attackCategory] ?? (target.attrs?.dx ?? 5) * 2
  const sides = 6
  const dice = Math.floor(Math.random() * sides) + 1
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
  const merged: Record<string, number> = {}
  const allKeys = new Set([...Object.keys(hero.attrs), ...Object.keys(equip)])
  for (const k of allKeys) {
    merged[k] = (hero.attrs[k] ?? 0) + (equip[k] ?? 0)
  }
  return merged
}

function applyHeroSkillModifiers(skills: HeroSkill[], merged: Record<string, number>, baseHp: number, baseMp: number, level: number): { finalHp: number; finalMp: number; merged: Record<string, number>; heroDef: number; thornsPct: number; vampirePct: number; counterPct: number } {
  let finalHp = baseHp
  let finalMp = baseMp
  let heroDef = calcDefenseBase(merged as any) + level * 2
  let thornsPct = 0
  let vampirePct = 0
  let counterPct = 0
  for (const s of skills) {
    if (s.effect === 'hp_up') finalHp += Math.round(finalHp * 0.2)
    else if (s.effect === 'mp_up') finalMp += Math.round(finalMp * 0.2)
    else if (s.effect === 'accuracy_up') merged.dx = (merged.dx ?? 0) + 5
    else if (s.effect === 'speed_up') merged.ag = (merged.ag ?? 0) + 5
    else if (s.effect === 'fortitude') heroDef += 10
    else if (s.effect === 'thorns') thornsPct = 20
    else if (s.effect === 'vampire') vampirePct = 20
    else if (s.effect === 'counter') counterPct = 30
  }
  return { finalHp, finalMp, merged, heroDef, thornsPct, vampirePct, counterPct }
}

function buildHeroDefenseValues(ds: Record<string, number | null>, skills: HeroSkill[], merged: Record<string, number>): { defenseValues: Record<string, number>; defenseSkillNames: Record<string, string>; defenseEffects: Record<string, string> } {
  const defenseValues: Record<string, number> = {}
  const defenseSkillNames: Record<string, string> = {}
  const defenseEffects: Record<string, string> = {}
  for (const cat of ['melee', 'ranged', 'magic']) {
    const skillId = ds[cat]
    const heroSkill = skillId ? skills.find(s => s.skillId === skillId) : null
    defenseValues[cat] = heroSkill?.formula
      ? evalDefenseFormula(heroSkill.formula, merged, heroSkill.rank ?? 1)
      : (merged.dx ?? 5) * 2
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

function toUnit(hero: HeroData, hp: number, mp: number): CombatUnit & { attrs: Record<string, number> } {
  const equip = hero.equipStats ?? {}
  const merged = mergeHeroAttrs(hero, equip)
  const { finalHp, finalMp, merged: mergedMod, heroDef, thornsPct, vampirePct, counterPct } = applyHeroSkillModifiers(hero.skills, merged, hp + (equip.hp ?? 0), mp + (equip.mp ?? 0), hero.level)
  const { defenseValues, defenseSkillNames, defenseEffects } = buildHeroDefenseValues(hero.combatProfile.defenseSkills ?? {}, hero.skills, mergedMod)
  const resistances = buildHeroResistances(equip)
  return {
    id: hero.id, name: hero.name, icon: '🧙', level: hero.level,
    hp: finalHp, maxHp: finalHp,
    mp: finalMp, maxMp: finalMp,
    isHero: true, isAlly: false,
    position: hero.combatProfile.position,
    condition: 'ready',
    attrs: mergedMod,
    def: heroDef,
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

function enemyToUnit(e: EnemyData, idx: number): CombatUnit {
  const defenseValues: Record<string, number> = {}
  const defenseSkillNames: Record<string, string> = {}
  const defenseEffects: Record<string, string> = {}
  for (const cat of ['melee', 'ranged', 'magic']) {
    const defSkill = (e.skills ?? []).find(s => s.defenseCategory === cat || s.defenseCategory === 'all')
    defenseValues[cat] = defSkill?.formula
      ? evalDefenseFormula(defSkill.formula, { atk: e.atk, def: e.def, dx: e.dx, ag: e.ag, level: e.level }, 1)
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

function rollLoot(table: DungeonData['lootTable']): Array<{ itemId: number; qty: number }> {
  const result: Array<{ itemId: number; qty: number }> = []
  for (const entry of table) {
    if (Math.random() < entry.chance) {
      const qty = entry.minQty + Math.floor(Math.random() * (entry.maxQty - entry.minQty + 1))
      result.push({ itemId: entry.itemId, qty })
    }
  }
  return result
}

function assignLootToHeroes(
  rawLoot: Array<{ itemId: number; qty: number }>,
  heroUnits: CombatUnit[],
): Array<{ itemId: number; qty: number; heroId: string; heroName: string }> {
  const alive = heroUnits.filter(h => h.hp > 0)
  if (alive.length === 0) return rawLoot.map(l => ({ ...l, heroId: '', heroName: '' }))

  return rawLoot.map(l => {
    const hero = alive[Math.floor(Math.random() * alive.length)]
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
  const basic = hero.skills.find(s => s.effect === 'attack' || !s.effect)
  if (basic) return basic
  // Fallback genérico clase-neutral
  return { skillId: 1, name: 'Ataque', multiplier: 1, manaCost: 5, effect: 'attack' as const, rank: 1, cooldownRounds: 0, formula: { attrCoeffs: { st: 1, dx: 1, in: 1, wi: 1 }, skillRankCoeff: 1, diceSides: 6, diceCount: 1, diceDivisor: 6, flatBonus: 3 } }
}

function getItem(consumables: Array<{ itemId: number; healHp?: number; healMp?: number }>, itemId: number) {
  return consumables.find(c => c.itemId === itemId)
}

function consumeItem(consumables: Array<{ itemId: number; healHp?: number; healMp?: number }>, itemId: number) {
  const idx = consumables.findIndex(c => c.itemId === itemId)
  if (idx !== -1) consumables.splice(idx, 1)
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
  if (item.healHp) {
    const actual = Math.min(item.healHp, heroUnit.maxHp - heroUnit.hp)
    heroUnit.hp = applyHpHealing(heroUnit.hp, heroUnit.maxHp, actual).currentHp
    addLog(log, 'heal', 0, level, 'prelim', `${heroUnit.name} usa item_${item.itemId} → recupera ${actual} HP`, { actor: heroUnit.name, skill: `item_${item.itemId}`, value: actual })
  }
  if (item.healMp) {
    const actual = Math.min(item.healMp, heroUnit.maxMp - heroUnit.mp)
    heroUnit.mp = Math.min(heroUnit.maxMp, heroUnit.mp + actual)
    addLog(log, 'heal', 0, level, 'prelim', `${heroUnit.name} usa item_${item.itemId} → recupera ${actual} MP`, { actor: heroUnit.name, skill: `item_${item.itemId}`, value: actual })
  }
  consumeItem(hero.consumables ?? [], rule.itemId)
}

function applyPrelimSkill(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  skill: any,
  state: CombatState,
  log: LogEntry[],
  level: number
) {
  if (skill.effect === 'party_attack_up') {
    const bonus = Math.round((skill.multiplier || 1.5) * 10)
    addBuff(state, 'atk', bonus, skill.name ?? 'ATK grupal', 'hero', BUFF_DURATION)
    addLog(log, 'buff', 0, level, 'prelim', `${heroUnit.name} usa skill_${skill.skillId} → +${bonus}% ATK grupal`, { actor: heroUnit.name, skill: `skill_${skill.skillId}`, value: bonus })
    return
  }
  if (skill.effect === 'defense_up') {
    const bonus = Math.round((skill.multiplier || 1) * 10)
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

function calcManaCost(baseMana: number, rank: number): number {
  if (baseMana <= 0) return 0
  return baseMana + Math.round(baseMana * 0.2 * (rank - 1))
}

function resolveDefenseEffect(
  target: CombatUnit,
  damage: number,
  defenseEffect: string | undefined,
): { damage: number; absorbed: number; dodged: boolean } {
  const result = resolveIncomingDamage({
    damage,
    defense: defenseEffect,
    currentMp: target.mp,
    random: { next: () => Math.random() },
  })
  target.mp -= result.mpSpent
  return { damage: result.finalDamage, absorbed: result.absorbedByBarrier, dodged: result.dodged }
}

function actionResultType(hit: boolean | null, crit: boolean | null): 'failed' | 'success' | 'critical_success' | undefined {
  if (hit === null) return undefined
  if (hit) return crit ? 'critical_success' : 'success'
  return 'failed'
}

function applyDamageToTarget(target: CombatUnit, dmg: number, ctx: CombatCtx, actor: string, skillName: string, heroUnits: CombatUnit[], enemyUnits: CombatUnit[], attacker?: CombatUnit): boolean {
  target.hp = applyHpDamage(target.hp, dmg).currentHp
  target.condition = getCondition(target.hp, target.maxHp)
  ctx.state!.damagedThisRound = true
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
  return {
    initiative: o.initiative, actionNumber: o.actionNum, totalActions: o.total,
    actorId: o.heroUnit.id, actorName: o.heroUnit.name, actorIcon: o.heroUnit.icon,
    skillId: o.skill?.skillId ?? (o.action?.skillId ?? 0),
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
  const consumables = hero.consumables ?? []
  const item = getItem(consumables, itemId)
  if (!item) return null
  const itemName = `item_${item.itemId}`
  if (item.healHp) {
    const actual = Math.min(item.healHp, heroUnit.maxHp - heroUnit.hp)
    heroUnit.hp = applyHpHealing(heroUnit.hp, heroUnit.maxHp, actual).currentHp
    const msg = `${heroUnit.name} usa ${itemName} → recupera ${actual} HP`
    addLog(ctx.log, 'heal', ctx.round, ctx.level, 'combat', msg, { actor: heroUnit.name, skill: itemName, value: actual })
    consumeItem(consumables, itemId)
    return makeDetail({ skill: null, heroUnit, target: null, action, initiative, actionNum, total: totalActions, dmg: null, hit: null, crit: null, healA: actual, healT: 'hp', buffN: null, buffV: null, itemN: itemName, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg })
  }
  if (item.healMp) {
    const actual = Math.min(item.healMp, heroUnit.maxMp - heroUnit.mp)
    heroUnit.mp = Math.min(heroUnit.maxMp, heroUnit.mp + actual)
    const msg = `${heroUnit.name} usa ${itemName} → recupera ${actual} MP`
    addLog(ctx.log, 'heal', ctx.round, ctx.level, 'combat', msg, { actor: heroUnit.name, skill: itemName, value: actual })
    consumeItem(consumables, itemId)
    return makeDetail({ skill: null, heroUnit, target: null, action, initiative, actionNum, total: totalActions, dmg: null, hit: null, crit: null, healA: actual, healT: 'mp', buffN: null, buffV: null, itemN: itemName, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg })
  }
  return null
}

function handleHeroSkillMana(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  hero: HeroData,
  skill: HeroSkill,
  ctx: CombatCtx,
): { skill: HeroSkill; mpCost: number } {
  const rank = skill.rank ?? 1
  const baseMana = skill.manaCost ?? 0
  const mpCost = calcManaCost(baseMana, rank)
  if (baseMana > 0 && heroUnit.mp < mpCost) {
    // Not enough mana — find a free skill (basic attack) to use instead
    const freeSkill = hero.skills.find(s => (s.manaCost ?? 0) === 0 && (s.effect === 'attack' || !s.effect))
    if (freeSkill) {
      const oldName = skill.name ?? `skill_${skill.skillId}`
      addLog(ctx.log, 'tactic_eval', ctx.round, ctx.level, 'combat',
        `${heroUnit.name} — sin maná para ${oldName}, usa ${freeSkill.name ?? 'Ataque básico'}`,
        { actor: heroUnit.name, skill: freeSkill.name })
      return { skill: freeSkill, mpCost: 0 }
    }
    // No free skill available — use basic attack with no mana cost
    const basicFallback = hero.skills.find(s => (s.effect === 'attack' || !s.effect))
    if (basicFallback) {
      const oldName = skill.name ?? `skill_${skill.skillId}`
      addLog(ctx.log, 'tactic_eval', ctx.round, ctx.level, 'combat',
        `${heroUnit.name} — sin maná ni ataque gratis para ${oldName}, usa ${basicFallback.name ?? 'Ataque básico'}`,
        { actor: heroUnit.name, skill: basicFallback.name })
      return { skill: basicFallback, mpCost: 0 }
    }
    // Last resort: force skill but deduct whatever MP is available (partial cost)
    heroUnit.mp = 0
    return { skill, mpCost: 0 }
  }
  // Enough mana — deduct it
  heroUnit.mp = Math.max(0, heroUnit.mp - mpCost)
  return { skill, mpCost }
}

function executeHeroHealAction(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  skill: HeroSkill,
  skillName: string,
  ctx: CombatCtx,
  meta: ActionMeta,
): DetailedAction | null {
  const state = ctx.state!
  const injured = [state.hero, ...state.allies].filter(u => u.hp > 0 && u.hp < u.maxHp)
  const target = injured.toSorted((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] ?? null
  if (!target) {
    return makeDetail({ skill, heroUnit, target: null, action: meta.action!, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg: `${heroUnit.name} usa ${skillName} — sin objetivo para curar`, mpCost: meta.mpCost })
  }
  const healed = calcHeal(target.maxHp, skill.healPct!)
  const actual = Math.min(healed, target.maxHp - target.hp)
  target.hp = applyHpHealing(target.hp, target.maxHp, actual).currentHp
  target.condition = getCondition(target.hp, target.maxHp)
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
  rank: number,
): DetailedAction {
  const state = ctx.state!
  const isAtk = skill.effect === 'party_attack_up'
  const bonus = Math.round((skill.multiplier || (isAtk ? 1.5 : 1)) * 10) + rank * 2
  addBuff(state, isAtk ? 'atk' : 'def', bonus, skillName, 'hero', BUFF_DURATION)
  const label = isAtk ? 'ATK grupal' : 'DEF grupal'
  const msg = `${heroUnit.name} usa ${skillName} → +${bonus}% ${label}`
  addLog(ctx.log, 'buff', ctx.round, ctx.level, 'combat', msg, { actor: heroUnit.name, skill: skillName, value: bonus })
  return makeDetail({ skill, heroUnit, target: null, action: meta.action!, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: null, healT: null, buffN: label, buffV: bonus, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg, mpCost: meta.mpCost })
}

function processAoeTarget(
  enemy: CombatUnit,
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  cfg: HeroAoeProcessConfig,
  ctx: CombatCtx,
): TargetResult {
  const { skill, skillName, aCat, atkTotal, adjAttack, isArmorPen, isCritAuto, formula } = cfg
  const state = ctx.state!
  const { total: defVal, dice: defDice } = getDefenseValue(enemy, aCat)
  const hit = resolveAttackHit({ attackTotal: atkTotal, defenseValue: defVal }).hit
  if (!hit) {
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
  const critRoll = resolveCritical({ attackerDexterity: heroUnit.attrs.dx, forced: isCritAuto, random: { next: () => Math.random() } }).critical
  const critAdj = critRoll ? Math.round(adjAttack * CRIT_MULTIPLIER) : adjAttack
  const dt = formula?.damageType ?? 'physical'
  const dmg = calcActualDamage(critAdj, state.groupAtkBonus, enemy.def ?? 5, isArmorPen, dt, enemy.resistances)
  const defEff = enemy.defenseEffects?.[aCat]
  const resolved = resolveDefenseEffect(enemy, dmg, defEff)
  const finalDmg = resolved.damage
  applyDamageToTarget(enemy, finalDmg, ctx, heroUnit.name, skillName, allHeroUnits, allEnemyUnits, heroUnit)
  applyCritEffects(critRoll, enemy, finalDmg, ctx, heroUnit.name)
  applyVampireHeal(heroUnit, finalDmg, ctx)
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
): DetailedAction {
  const { skill, skillName, formula } = skillInfo
  const { adjAttack, isArmorPen, isCritAuto } = atkValues
  const state = ctx.state!
  const atkTotal = adjAttack
  const aCat = inferAttackCategory(skill, heroUnit.position)
  const targetResults: TargetResult[] = []
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue
    const aoeCfg: HeroAoeProcessConfig = { skill, skillName, aCat, atkTotal, adjAttack, isArmorPen, isCritAuto, formula }
    const tr = processAoeTarget(enemy, heroUnit, aoeCfg, ctx)
    targetResults.push(tr)
  }
  return makeDetail({ skill, heroUnit, target: null, action: meta.action!, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg: `${heroUnit.name} usa ${skillName} — ataque múltiple`, mpCost: meta.mpCost, targetResults })
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
  const se = statusEffectFromDamageType(dt as DamageType, atkOrBase)
  if (se) applyStatusEffect(target, se.type, se.value, se.rounds, sourceName, ctx)
}

function executeHeroSingleTargetAttack(
  heroUnit: CombatUnit & { attrs: Record<string, number> },
  skillInfo: HeroSkillAttackInfo,
  ctx: CombatCtx,
  meta: ActionMeta,
  atkValues: AttackValues,
  extraUnits?: ExtraUnitArrays,
): DetailedAction | null {
  const { skill, skillName, formula } = skillInfo
  const { fResult, adjAttack, isArmorPen, isCritAuto } = atkValues
  const state = ctx.state!
  const allHeroUnits = extraUnits?.allHeroUnits ?? [state.hero, ...state.allies]
  const allEnemyUnits = extraUnits?.allEnemyUnits ?? state.enemies
  const target = resolveTarget(meta.action!, state, heroUnit.position, skill.tags)
  if (!target) return null

  const aCat = inferAttackCategory(skill, heroUnit.position)
  const atkTotal = adjAttack
  const { total: defVal, dice: defDice } = getDefenseValue(target, aCat)
  const hit = resolveAttackHit({ attackTotal: atkTotal, defenseValue: defVal }).hit
  if (!hit) {
    const msg = `${heroUnit.name} usa ${skillName} → fallo`
    addLog(ctx.log, 'miss', ctx.round, ctx.level, 'combat', msg, { actor: heroUnit.name, target: target.name, skill: skillName })
    return makeDetail({ skill, heroUnit, target, action: meta.action!, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: false, crit: null, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal, defRoll: defDice, defSkill: undefined, defEffect: target.defenseEffects?.[aCat], defEquip: target.armorName, msg, rollBase: fResult!.base, rollDice: fResult!.diceTotal, attackTotal: atkTotal, mpCost: meta.mpCost })
  }

  const critRoll = isCritAuto ? true : rollCrit(heroUnit.attrs.dx)
  const critAdj = critRoll ? Math.round(adjAttack * CRIT_MULTIPLIER) : adjAttack
  const dt = formula?.damageType ?? 'physical'
  const dmg = calcActualDamage(critAdj, state.groupAtkBonus, target.def ?? 5, isArmorPen, dt, target.resistances)

  const defEff = target.defenseEffects?.[aCat]
  const resolved = resolveDefenseEffect(target, dmg, defEff)
  const finalDmg = resolved.damage

  target.hp = applyHpDamage(target.hp, finalDmg).currentHp
  target.condition = getCondition(target.hp, target.maxHp)
  state.damagedThisRound = finalDmg > 0

  if (!resolved.dodged && target.hp > 0 && formula?.damageType && formula.damageType !== 'physical') {
    applyStatusEffectFromDamage(formula.damageType, fResult!.base, target, heroUnit.name, ctx)
  }

  applyCritEffects(critRoll, target, finalDmg, ctx, heroUnit.name)
  applyVampireHeal(heroUnit, finalDmg, ctx)
  processPassiveEffects('on_damage', target, allHeroUnits, allEnemyUnits, heroUnit, ctx)

  const msg = buildHeroAttackLogMessage(heroUnit, skillName, critRoll, isCritAuto, finalDmg, resolved, target)
  addLog(ctx.log, critRoll ? 'crit' : 'hit', ctx.round, ctx.level, 'combat', msg, { actor: heroUnit.name, target: target.name, skill: skillName, value: finalDmg })
  if (target.hp <= 0) processUnitDefeat(target, heroUnit, allHeroUnits, allEnemyUnits, ctx)
  const detail = makeDetail({ skill, heroUnit, target, action: meta.action!, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: finalDmg, hit: true, crit: critRoll, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal, defRoll: defDice, defSkill: undefined, defEffect: defEff, defEquip: target.armorName, msg, rollBase: fResult!.base, rollDice: fResult!.diceTotal, attackTotal: atkTotal, mpCost: meta.mpCost })
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
  if (action.itemId) return executeHeroItemAction(heroUnit, hero, action, ctx, meta.initiative, meta.actionNum, meta.totalActions)

  let skill = getSkill(hero, action.skillId)
  const skillName = skill.name ?? `skill_${skill.skillId}`
  const rank = skill.rank ?? 1
  const formula = skill.formula

  const { skill: resolvedSkill, mpCost } = handleHeroSkillMana(heroUnit, hero, skill, ctx)
  skill = resolvedSkill

  const effect = skill.effect ?? 'attack'

  if (effect === 'heal' && skill.healPct) {
    return executeHeroHealAction(heroUnit, skill, skillName, ctx, { ...meta, mpCost })
  }
  if (effect === 'party_attack_up' || effect === 'defense_up') {
    return executeHeroBuffAction(heroUnit, skill, skillName, ctx, { ...meta, mpCost }, rank)
  }

  const isArmorPen = effect === 'armor_penetration'
  const isCritAuto = effect === 'critical_attack'
  const isAoe = effect === 'aoe_attack'

  const fResult = evaluateFormula(formula, heroUnit.attrs, rank)
  const adjAttack = applyDiceMultiplier(fResult.base, fResult.diceTotal, formula?.diceCount ?? 0, formula?.diceSides ?? 0, formula?.diceDivisor)

  if (isAoe) {
    const skillInfo: HeroSkillAttackInfo = { skill, skillName, formula }
    const atkValues: AttackValues = { adjAttack, isArmorPen, isCritAuto }
    return executeHeroAoeAttack(heroUnit, skillInfo, ctx, { ...meta, mpCost }, atkValues)
  }

  const skillInfo: HeroSkillAttackInfo = { skill, skillName, formula }
  const atkValues: AttackValues = { fResult, adjAttack, isArmorPen, isCritAuto }
  return executeHeroSingleTargetAttack(heroUnit, skillInfo, ctx, { ...meta, mpCost }, atkValues, extraUnits)
}

// ─── ACCIÓN DEL ENEMIGO (IA SIMPLE) ─────────────────────────────────────────

function pickEnemyTarget(heroUnits: CombatUnit[], ai?: { type: string }): CombatUnit | null {
  const alive = heroUnits.filter(h => h.hp > 0)
  if (alive.length === 0) return null
  if (ai?.type === 'weakest') {
    return alive.reduce((min, h) => h.hp < min.hp ? h : min, alive[0])
  }
  if (ai?.type === 'strongest') {
    return alive.reduce((max, h) => h.hp > max.hp ? h : max, alive[0])
  }
  if (Math.random() < 0.4) {
    return alive.reduce((min, h) => h.hp < min.hp ? h : min, alive[0])
  }
  const front = alive.filter(h => h.position === 'front')
  const rear = alive.filter(h => h.position === 'rear')
  let pool: CombatUnit[]
  if (Math.random() < 0.7) {
    pool = front.length > 0 ? front : rear
  } else {
    pool = rear.length > 0 ? rear : front
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

function isEnemySkillOnCooldown(state: CombatState, actorId: string, skillId: number): boolean {
  return !!state.skillCooldowns?.[actorId]?.[skillId]
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
      (buffSkill.effect === 'party_attack_up' && state.groupAtkBonus === 0) ||
      (buffSkill.effect === 'defense_up' && state.groupDefBonus === 0)
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

function executeEnemyBuffEffect(enemy: EnemyData, enemyUnit: CombatUnit, chosenSkill: EnemySkillRef, skillName: string, ctx: CombatCtx, meta: ActionMeta): DetailedAction {
  const state = ctx.state!
  const bonus = Math.round((chosenSkill.multiplier || 1.5) * 10)
  addBuff(state, 'atk', bonus, skillName, 'enemy', BUFF_DURATION)
  const msg = `${enemyUnit.name} usa ${skillName} → +${bonus}% ATK enemigos`
  addLog(ctx.log, 'buff', ctx.round, ctx.level, 'combat', msg, { actor: enemyUnit.name, skill: skillName, value: bonus })
  const sk = makeEnemySkillObj(chosenSkill, enemy, skillName, chosenSkill.icon, (chosenSkill.damageType ?? 'physical') as DamageType)
  return makeDetail({ skill: sk, heroUnit: enemyUnit, target: null, action: { skillId: enemy.id, targetPos: 'auto', targetType: 'self' }, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: null, healT: null, buffN: 'ATK grupal', buffV: bonus, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg })
}

function executeEnemyHealEffect(enemy: EnemyData, enemyUnit: CombatUnit, chosenSkill: EnemySkillRef, skillName: string, ctx: CombatCtx, meta: ActionMeta): DetailedAction | null {
  if (enemyUnit.hp >= enemyUnit.maxHp) return null
  const healPct = (chosenSkill.formula as any)?.healPct ?? 30
  const healed = calcHeal(enemyUnit.maxHp, healPct)
  const actual = Math.min(healed, enemyUnit.maxHp - enemyUnit.hp)
  enemyUnit.hp = applyHpHealing(enemyUnit.hp, enemyUnit.maxHp, actual).currentHp
  const msg = `${enemyUnit.name} usa ${skillName} → recupera ${actual} HP`
  addLog(ctx.log, 'heal', ctx.round, ctx.level, 'combat', msg, { actor: enemyUnit.name, skill: skillName, value: actual })
  const sk = makeEnemySkillObj(chosenSkill, enemy, skillName, chosenSkill.icon, (chosenSkill.damageType ?? 'physical') as DamageType)
  return makeDetail({ skill: sk, heroUnit: enemyUnit, target: enemyUnit, action: { skillId: enemy.id, targetPos: 'auto', targetType: 'self' }, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: actual, healT: 'hp', buffN: null, buffV: null, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg })
}

function processEnemyAoeTarget(hero: CombatUnit, enemy: EnemyData, enemyUnit: CombatUnit, cfg: EnemyAoeProcessConfig, ctx: CombatCtx): TargetResult {
  const { chosenSkill, skillName, aCat, atkTotal, adjAttack, isArmorPen } = cfg
  const state = ctx.state!
  const { total: defVal, dice: defDice } = getDefenseValue(hero, aCat)
  const hit = defVal <= atkTotal
  if (!hit) {
    addLog(ctx.log, 'miss', ctx.round, ctx.level, 'combat', `${enemyUnit.name} usa ${skillName} → fallo (${hero.name})`, { actor: enemyUnit.name, target: hero.name, skill: skillName })
    return {
      targetId: hero.id, targetName: hero.name,
      defenseValue: defVal, defenseRoll: defDice, defenseSkill: hero.defenseSkillNames?.[aCat],
      defenseEffect: hero.defenseEffects?.[aCat],
      resultType: 'failed',
    }
  }
  const critRoll = rollCrit(enemy.dx)
  const critAdj = critRoll ? Math.round(adjAttack * CRIT_MULTIPLIER) : adjAttack
  const dt: DamageType = (chosenSkill?.damageType ?? enemy.damageType ?? 'physical') as DamageType
  const dmg = calcActualDamage(critAdj, state.groupAtkBonus, hero.def ?? 5, isArmorPen, dt, hero.resistances)
  const defEff = hero.defenseEffects?.[aCat]
  const resolved = resolveDefenseEffect(hero, dmg, defEff)
  const finalDmg = resolved.damage
  applyDamageToTarget(hero, finalDmg, ctx, enemyUnit.name, skillName, heroUnits, allEnemyUnits, enemyUnit)
  applyCritEffects(critRoll, hero, finalDmg, ctx, enemyUnit.name)
  const tr: TargetResult = {
    targetId: hero.id, targetName: hero.name,
    defenseValue: defVal, defenseRoll: defDice, defenseSkill: hero.defenseSkillNames?.[aCat],
    defenseEffect: defEff,
    resultType: critRoll ? 'critical_success' : 'success',
    damageBreakdown: [{ type: dt, value: finalDmg }],
  }
  if (resolved.absorbed > 0) tr.absorbed = resolved.absorbed
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
): DetailedAction {
  const { chosenSkill, skillName } = actionSkill
  const { fResult, adjAttack, isArmorPen } = atkValues
  const state = ctx.state!
  const atkTotal = adjAttack
  const aCat = inferAttackCategory(chosenSkill ?? undefined, enemyUnit.position)
  const targetResults: TargetResult[] = []
  for (const hero of heroUnits) {
    if (hero.hp <= 0) continue
    const aoeCfg: EnemyAoeProcessConfig = { chosenSkill, skillName, aCat, atkTotal, adjAttack, isArmorPen }
    const tr = processEnemyAoeTarget(hero, enemy, enemyUnit, aoeCfg, ctx)
    targetResults.push(tr)
  }
  const sk = makeEnemySkillObj(chosenSkill, enemy, skillName, chosenSkill?.icon ?? enemy.skillIcon, (chosenSkill?.damageType ?? enemy.damageType ?? 'physical') as DamageType)
  return makeDetail({ skill: sk, heroUnit: enemyUnit, target: null, action: { skillId: enemy.id, targetPos: 'auto', targetType: 'weakest' }, initiative: meta.initiative, actionNum: meta.actionNum, total: meta.totalActions, dmg: null, hit: null, crit: null, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal: undefined, defRoll: undefined, defSkill: undefined, defEffect: undefined, defEquip: undefined, msg: `${enemyUnit.name} usa ${skillName} — ataque múltiple`, targetResults })
}

function executeEnemySingleTargetAttack(
  enemy: EnemyData, enemyUnit: CombatUnit, heroUnits: CombatUnit[],
  chosenSkill: EnemySkillRef | null, skillName: string, damageType: DamageType,
  fResult: { base: number; diceTotal: number } | null, adjAttack: number, isArmorPen: boolean,
  target: CombatUnit, state: CombatState, ctx: CombatCtx,
  initiative: number, actionNum: number, totalActions: number,
  aCat: string
): DetailedAction | null {
  const { total: defVal, dice: defDice } = getDefenseValue(target, aCat)
  const { hit, rollBase, rollDice, attackTotal } = computeEnemyHitValues(fResult, adjAttack, enemy, defVal)

  if (!hit) {
    return makeEnemyMissDetail(enemy, enemyUnit, chosenSkill, skillName, damageType, target, defVal, defDice, aCat, attackTotal, rollBase, rollDice, ctx, initiative, actionNum, totalActions)
  }

  const crit = resolveCritical({ attackerDexterity: enemy.dx, random: { next: () => Math.random() } }).critical
  const dmg = computeEnemyDamageWithFallback({ fResult, adjAttack, crit, enemy, chosenSkill, isArmorPen, dt: damageType }, ctx, target)
  const defEff = target.defenseEffects?.[aCat]
  const resolved = resolveDefenseEffect(target, dmg, defEff)
  let finalDmg = resolved.damage
  const { absorbed, finalDmg: afterShield } = applyManaShieldAbsorption(target, state, finalDmg, ctx)
  finalDmg = afterShield

  target.hp = applyHpDamage(target.hp, finalDmg).currentHp
  target.condition = getCondition(target.hp, target.maxHp)
  state.damagedThisRound = finalDmg > 0

  applyThornsReflect(target, enemyUnit, finalDmg, ctx, heroUnits, allEnemyUnits)
  applyCritEffects(crit, target, finalDmg, ctx, enemyUnit.name)
  applyCounterAttack(target, enemyUnit, finalDmg, aCat, ctx, heroUnits, allEnemyUnits)

  const defSuffix = buildEnemyDefSuffix(resolved, absorbed)
  const msg = buildEnemyAttackMessage(enemyUnit, skillName, attackTotal, crit, finalDmg, defSuffix, target)
  addLog(ctx.log, crit ? 'crit' : 'hit', ctx.round, ctx.level, 'combat', msg, { actor: enemyUnit.name, target: target.name, value: finalDmg })
  applyEnemyPostDamageEffects(target, damageType, enemy, enemyUnit, resolved, ctx, state, heroUnits, allEnemyUnits)

  const sk = makeEnemySkillObj(chosenSkill, enemy, skillName, chosenSkill?.icon ?? enemy.skillIcon, damageType)
  const detail = makeDetail({ skill: sk, heroUnit: enemyUnit, target, action: { skillId: enemy.id, targetPos: 'auto', targetType: 'weakest' }, initiative, actionNum, total: totalActions, dmg: finalDmg > 0 ? finalDmg : dmg, hit: true, crit, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal, defRoll: defDice, defSkill: undefined, defEffect: defEff, defEquip: target.armorName, msg, rollBase, rollDice, attackTotal })
  if (absorbed > 0) detail.absorbed = absorbed
  if (resolved.absorbed > 0) detail.absorbed = (detail.absorbed ?? 0) + resolved.absorbed
  return detail
}

function makeEnemyMissDetail(
  enemy: EnemyData, enemyUnit: CombatUnit, chosenSkill: EnemySkillRef | null,
  skillName: string, damageType: DamageType, target: CombatUnit,
  defVal: number, defDice: number, aCat: string, attackTotal: number,
  rollBase: number, rollDice: number, ctx: CombatCtx,
  initiative: number, actionNum: number, totalActions: number
): DetailedAction {
  const msg = `${enemyUnit.name} ataca (${skillName}/${attackTotal}) → ${target.name}: fallo`
  addLog(ctx.log, 'miss', ctx.round, ctx.level, 'combat', msg, { actor: enemyUnit.name, target: target.name })
  const sk = makeEnemySkillObj(chosenSkill, enemy, skillName, chosenSkill?.icon ?? enemy.skillIcon, damageType)
  return makeDetail({ skill: sk, heroUnit: enemyUnit, target, action: { skillId: enemy.id, targetPos: 'auto', targetType: 'weakest' }, initiative, actionNum, total: totalActions, dmg: null, hit: false, crit: null, healA: null, healT: null, buffN: null, buffV: null, itemN: null, defVal, defRoll: defDice, defSkill: undefined, defEffect: target.defenseEffects?.[aCat], defEquip: target.armorName, msg, rollBase, rollDice, attackTotal })
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

function computeEnemyDamageWithFallback(params: EnemyDamageParams, ctx: CombatCtx, target: CombatUnit): number {
  const { fResult, adjAttack, crit, enemy, chosenSkill, isArmorPen, dt } = params
  const state = ctx.state!
  if (fResult) {
    const critAdj = crit ? Math.round(adjAttack * CRIT_MULTIPLIER) : adjAttack
    return calcActualDamage(critAdj, state.groupAtkBonus, target.def ?? 5, isArmorPen, dt, target.resistances)
  }
  const skillMult = chosenSkill?.multiplier ?? 1
  const raw = Math.max(1, Math.round(
    (enemy.atk * skillMult * (crit ? CRIT_MULTIPLIER : 1))
    - (target.def ?? 5) * 0.8 * (1 + state.groupDefBonus / 100)
  ))
  const resistPct = (target.resistances?.[dt] ?? 0) / 100
  return Math.max(1, Math.round(raw * (1 - resistPct)))
}

function computeEnemyHitValues(fResult: { base: number; diceTotal: number } | null, adjAttack: number, enemy: EnemyData, defVal: number): { hit: boolean; rollBase: number; rollDice: number; attackTotal: number } {
  if (fResult) {
    const rollBase = fResult.base
    const rollDice = fResult.diceTotal
    const attackTotal = adjAttack
    return { hit: attackTotal >= (defVal ?? 5), rollBase, rollDice, attackTotal }
  }
  const rollBase = Math.round(enemy.atk)
  const rollDice = Math.floor(Math.random() * 10) + 1
  const attackTotal = rollBase + rollDice
  return { hit: (defVal ?? 10) <= attackTotal, rollBase, rollDice, attackTotal }
}

function applyManaShieldAbsorption(target: CombatUnit, state: CombatState, dmg: number, ctx: CombatCtx): { absorbed: number; finalDmg: number } {
  if (state.manaShield && target.mp > 0 && dmg > 0) {
    const absorbed = Math.min(target.mp, dmg)
    target.mp -= absorbed
    const finalDmg = dmg - absorbed
    if (absorbed > 0) {
      addLog(ctx.log, 'buff', ctx.round, ctx.level, 'combat',
        `🛡️ Escudo de maná absorbe ${absorbed} daño`, { actor: target.name, value: absorbed })
    }
    return { absorbed, finalDmg }
  }
  return { absorbed: 0, finalDmg: dmg }
}

function applyThornsReflect(target: CombatUnit, enemyUnit: CombatUnit, finalDmg: number, ctx: CombatCtx, heroUnits: CombatUnit[], enemyUnits: CombatUnit[]): void {
  if (!target.thornsPct || finalDmg <= 0 || enemyUnit.hp <= 0) return
  const reflected = Math.max(1, Math.round(finalDmg * target.thornsPct / 100))
  enemyUnit.hp = applyHpDamage(enemyUnit.hp, reflected).currentHp
  enemyUnit.condition = getCondition(enemyUnit.hp, enemyUnit.maxHp)
  addLog(ctx.log, 'hit', ctx.round, ctx.level, 'combat',
    `🌵 ${target.name} refleja ${reflected} daño a ${enemyUnit.name}`,
    { target: enemyUnit.name, value: reflected })
  if (enemyUnit.hp <= 0) processUnitDefeat(enemyUnit, target, heroUnits, enemyUnits, ctx)
}

function applyCounterAttack(target: CombatUnit, enemyUnit: CombatUnit, finalDmg: number, aCat: string, ctx: CombatCtx, heroUnits: CombatUnit[], enemyUnits: CombatUnit[]): void {
  if (!target.counterPct || finalDmg <= 0 || target.hp <= 0 || enemyUnit.hp <= 0 || aCat !== 'melee') return
  const countered = Math.max(1, Math.round(finalDmg * target.counterPct / 100))
  enemyUnit.hp = applyHpDamage(enemyUnit.hp, countered).currentHp
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
  }

  const chosenSkill = pickEnemySkill(enemy, enemyUnit, state, ctx.round)
  const skillName = chosenSkill?.name ?? enemy.skillName ?? 'Ataque'
  const damageType = (chosenSkill?.damageType ?? enemy.damageType ?? 'physical') as DamageType

  if (chosenSkill) {
    applySkillCooldown(state, enemyUnit, null, chosenSkill.skillId, chosenSkill.cooldownRounds ?? 0)
  }

  if (chosenSkill?.effect === 'party_attack_up') {
    return executeEnemyBuffEffect(enemy, enemyUnit, chosenSkill, skillName, ctx, { initiative, actionNum, totalActions })
  }
  if (chosenSkill?.effect === 'heal') {
    const result = executeEnemyHealEffect(enemy, enemyUnit, chosenSkill, skillName, ctx, { initiative, actionNum, totalActions })
    if (result) return result
  }

  const isAoe = chosenSkill?.effect === 'aoe_attack'
  const isArmorPen = chosenSkill?.effect === 'armor_penetration'
  const formula = chosenSkill?.formula
  const fResult = formula ? evaluateFormula(formula, enemyAttrs, 1) : null
  const adjAttack = fResult ? applyDiceMultiplier(fResult.base, fResult.diceTotal, formula?.diceCount ?? 0, formula?.diceSides ?? 0, formula?.diceDivisor) : 0

  if (isAoe && fResult) {
    return executeEnemyAoeAttack(enemy, enemyUnit, heroUnits, { chosenSkill, skillName }, { fResult, adjAttack, isArmorPen }, ctx, { initiative, actionNum, totalActions })
  }

  const aCat = inferAttackCategory(chosenSkill ?? undefined, enemy.position)
  const target = pickEnemyTarget(heroUnits, enemy.ai)
  if (!target) return null

  return executeEnemySingleTargetAttack(enemy, enemyUnit, heroUnits, chosenSkill, skillName, damageType, fResult, adjAttack, isArmorPen, target, state, ctx, initiative, actionNum, totalActions, aCat)
}

// ─── EFECTOS DE ESTADO ────────────────────────────────────────────────────────

function applyStatusEffect(
  target: CombatUnit, type: StatusEffect['type'], value: number, rounds: number,
  sourceName: string, ctx: CombatCtx
) {
  const incoming: StatusEffect = { type, remainingRounds: rounds, value, source: sourceName, sourceName }
  target.statusEffects = [...applyLegacyStatusEffect(target.statusEffects ?? [], incoming)]
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
  if (doT > 0) {
    unit.hp = applyHpDamage(unit.hp, doT).currentHp
    unit.condition = getCondition(unit.hp, unit.maxHp)
    addLog(log, 'hit', round, level, 'combat',
      `☠️ ${unitName} recibe ${doT} daño de efectos`,
      { target: unitName, value: doT })
    if (unit.hp <= 0) {
      processUnitDefeat(unit, undefined, heroUnits, enemyUnits, ctx, `💀 ${unitName} derribado por efectos`)
    }
  }
  return doT
}

function isUnitStunned(unit: CombatUnit): boolean {
  return isLegacyCombatUnitDisabled(unit.statusEffects ?? [])
}

function decayStatusEffects(unit: CombatUnit) {
  if (!unit.statusEffects) return
  unit.statusEffects = [...advanceLegacyStatusRound(unit.statusEffects)]
}

function statusEffectFromDamageType(dt: DamageType, atk: number): { type: StatusEffect['type']; value: number; rounds: number } | null {
  switch (dt) {
    case 'poison': return { type: 'poison', value: Math.max(1, Math.round(atk * 0.15)), rounds: 3 }
    case 'fire': return { type: 'burn', value: Math.max(1, Math.round(atk * 0.2)), rounds: 2 }
    case 'ice': return { type: 'freeze', value: 0, rounds: 1 }
    case 'lightning': return { type: 'stun', value: 0, rounds: 1 }
    case 'holy': return { type: 'burn', value: Math.max(1, Math.round(atk * 0.25)), rounds: 2 }
    case 'psychological':
    case 'dark': return { type: 'stun', value: 0, rounds: 1 }
    case 'bleed':
    case 'piercing': return { type: 'bleed', value: Math.max(1, Math.round(atk * 0.1)), rounds: 3 }
    default: return null
  }
}

const BUFF_DURATION = 3  // rondas que duran los buffs de party_attack_up / defense_up

function recalcGroupBuffs(state: CombatState) {
  if (!state.buffs) state.buffs = []
  const bonuses = calculateLegacyGroupBuffBonuses(state.buffs)
  state.groupAtkBonus = bonuses.atk
  state.groupDefBonus = bonuses.def
}

function addBuff(state: CombatState, type: 'atk' | 'def', value: number, sourceName: string, side: 'hero' | 'enemy', duration: number | null) {
  state.buffs = [...applyLegacyCombatBuff(state.buffs ?? [], { type, value, sourceName, side, remainingRounds: duration })]
  recalcGroupBuffs(state)
}

function decayBuffs(state: CombatState) {
  if (!state.buffs) return
  state.buffs = [...advanceLegacyCombatBuffs(state.buffs)]
  recalcGroupBuffs(state)
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
  if (Math.random() < 0.15) {
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
  source.hp = applyHpHealing(source.hp, source.maxHp, healed).currentHp
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
    u.hp = applyHpDamage(u.hp, value).currentHp
    u.condition = getCondition(u.hp, u.maxHp)
    if (u.hp <= 0) processUnitDefeat(u, source, heroUnits, enemyUnits, ctx)
  }
  if (logMsg) addLog(ctx.log, 'hit', ctx.round, ctx.level, 'combat', logMsg, { target: source.name, value })
}

function damageUnit(unit: CombatUnit, value: number, source: CombatUnit, logMsg: string, ctx: CombatCtx, heroUnits: CombatUnit[], enemyUnits: CombatUnit[]): void {
  unit.hp = applyHpDamage(unit.hp, value).currentHp
  if (unit.condition) unit.condition = getCondition(unit.hp, unit.maxHp)
  if (logMsg) addLog(ctx.log, 'hit', ctx.round, ctx.level, 'combat', logMsg, { target: unit.name, value })
  if (unit.hp <= 0) processUnitDefeat(unit, source, heroUnits, enemyUnits, ctx)
}

function doPassiveHeal(u: CombatUnit, value: number, source: CombatUnit, pe: PassiveEffect, ctx: CombatCtx): void {
  if (u.hp <= 0) return
  const actual = Math.min(value, u.maxHp - u.hp)
  if (actual <= 0) return
  u.hp = applyHpHealing(u.hp, u.maxHp, actual).currentHp
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
    addBuff(ctx.state, buffType, value, `${source.name}:${pe.sourceName}`, t.isHero ? 'hero' : 'enemy', 2)
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
      ? { type: trigger, sourceId: source.id, targetId: source.id, ...(attacker ? { attackerId: attacker.id } : {}) }
      : { type: trigger, sourceId: source.id, targetId: source.id, ...(attacker ? { attackerId: attacker.id } : {}) }

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
  dispatchCombatEvent(event, [handler])
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
  if (!heroCooldowns[action.skillId]) return action
  const available = hero.skills.find(s => !heroCooldowns[s.skillId] && (s.effect === 'attack' || !s.effect))
  if (!available) return action
  const override: TacticAction = { skillId: available.skillId, targetPos: 'front', targetType: 'weakest' }
  addLog(log, 'tactic_eval', round, levelNum, 'combat',
    `⏳ ${actorUnit.name} — skill_${action.skillId} en cooldown, usando skill_${available.skillId}`,
    { actor: actorUnit.name, skill: `skill_${available.skillId}` })
  return override
}

function resolveBuffOverride(hero: HeroData, action: TacticAction, state: CombatState, actorUnit: CombatUnit, log: LogEntry[], round: number, levelNum: number): TacticAction {
  const chosenBuffSkill = hero.skills.find(s => s.skillId === action.skillId)
  if (!chosenBuffSkill || (chosenBuffSkill.effect !== 'party_attack_up' && chosenBuffSkill.effect !== 'defense_up')) return action
  const isAtk = chosenBuffSkill.effect === 'party_attack_up'
  if (isAtk ? state.groupAtkBonus <= 0 : state.groupDefBonus <= 0) return action
  const ataque = hero.skills.find(s => s.effect === 'attack' || !s.effect)
  if (!ataque) return action
  const override: TacticAction = { skillId: ataque.skillId, targetPos: 'front', targetType: 'weakest' }
  addLog(log, 'tactic_eval', round, levelNum, 'combat',
    `⏭️ ${actorUnit.name} — ${chosenBuffSkill.name ?? 'buff'} ya activo, usando ${ataque.name ?? 'Ataque básico'}`,
    { actor: actorUnit.name, skill: `skill_${ataque.skillId}` })
  return override
}

function applySkillCooldown(state: CombatState, actorUnit: CombatUnit, hero: HeroData | null, skillId: number, cooldownOverride?: number): void {
  let cd = cooldownOverride
  if (cd === undefined && hero) {
    const skillObj = getSkill(hero, skillId)
    cd = skillObj.cooldownRounds
  }
  if (!cd || cd <= 0) return
  state.skillCooldowns ??= {}
  if (!state.skillCooldowns[actorUnit.id]) state.skillCooldowns[actorUnit.id] = {}
  state.skillCooldowns[actorUnit.id][skillId] = cd
}

function decaySkillCooldowns(state: CombatState): void {
  if (!state.skillCooldowns) return
  for (const heroId of Object.keys(state.skillCooldowns)) {
    const cds = state.skillCooldowns[heroId]
    for (const skillId of Object.keys(cds)) {
      cds[Number(skillId)]--
    }
    state.skillCooldowns[heroId] = Object.fromEntries(
      Object.entries(cds).filter(([, v]) => v > 0)
    )
  }
}

function applyDarknessHeal(enemyUnits: CombatUnit[], state: CombatState, log: LogEntry[], round: number, levelNum: number): void {
  if (!state.factionBonuses?.darknessHeal) return
  for (const u of enemyUnits) {
    if (u.hp > 0 && u.faction === 'darkness') {
      const healed = Math.max(1, Math.round(u.maxHp * 0.08))
      u.hp = applyHpHealing(u.hp, u.maxHp, healed).currentHp
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

function applyManaRegen(heroUnits: CombatUnit[]): void {
  for (const hu of heroUnits) {
    if (hu.hp <= 0) continue
    const regen = 5 + Math.floor(hu.maxMp * 0.02)
    hu.mp = Math.min(hu.maxMp, hu.mp + regen)
  }
}

function processTrapsAutoWin(enemyUnits: CombatUnit[], log: LogEntry[], round: number, levelNum: number): boolean {
  const aliveNonTraps = enemyUnits.filter(e => e.hp > 0 && !e.trap)
  if (aliveNonTraps.length > 0 || !enemyUnits.some(e => e.hp > 0 && e.trap)) return false
  for (const e of enemyUnits) { if (e.trap) e.hp = 0 }
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
  fallbackSkillId: number, ai: number, totalActors: number,
  roundActions: DetailedAction[]
): DetailedAction | null {
  const heroIndex = heroUnits.indexOf(actorUnit)
  const hero = heroes[heroIndex]
  if (!hero) return null

  const perHeroState = buildPerHeroState(actorUnit, heroUnits, enemyUnits, state)
  const action = evalTactics(hero.combatProfile.roundRules, perHeroState, fallbackSkillId)
  addLog(log, 'tactic_eval', round, levelNum, 'combat', `⚡ Táctica: ${actorUnit.name} → skill_${action.skillId} → ${action.targetType}`, { actor: actorUnit.name, skill: `skill_${action.skillId}` })

  let finalAction = resolveCooldownOverride(hero, action, state, actorUnit, log, round, levelNum)
  finalAction = resolveBuffOverride(hero, finalAction, state, actorUnit, log, round, levelNum)

  const detail = executeHeroAction(actorUnit, hero, { action: finalAction, initiative: actor.initiative, actionNum: ai + 1, totalActions: totalActors }, { log, round, level: levelNum, state: perHeroState }, { allHeroUnits: heroUnits, allEnemyUnits: enemyUnits })
  if (detail) applySkillCooldown(state, actorUnit, hero, finalAction.skillId)
  return detail
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
    manaShield: state.manaShield ?? false,
    factionBonuses: state.factionBonuses,
    buffs: state.buffs,
  }
}

function runEnemyTurn(
  actorUnit: CombatUnit, lvl: DungeonLevel, heroUnits: CombatUnit[],
  state: CombatState, log: LogEntry[], round: number, levelNum: number,
  ai: number, totalActors: number
): DetailedAction | null {
  const enemyIndex = lvl.enemies.findIndex((e: any, i: number) => actorUnit.id === `enemy_${e.id}_${i}`)
  if (enemyIndex < 0) return null
  const enemyData = lvl.enemies[enemyIndex]
  if (!enemyData || actorUnit.hp <= 0) return null
  return executeEnemyAction(enemyData, actorUnit, heroUnits, { log, round, level: levelNum, state }, 0, ai + 1, totalActors)
}

export async function runDungeon(
  heroes: HeroData[],
  dungeon: DungeonData,
  options: { firstOfDay?: boolean; groupBonus?: boolean; clanBonuses?: Record<string, number> } = {}
): Promise<RunResult> {
  const clan = options.clanBonuses ?? {}
  const log: LogEntry[] = []
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
    toUnit(h, h.hpMax, h.mpMax)
  )

  // Skill básica del primer héroe para fallback táctico
  const mainHero = heroes[0]
  const basicSkill = mainHero?.skills.find(s => s.effect === 'attack' || !s.effect)
  const fallbackSkillId = basicSkill?.skillId ?? (mainHero?.skills[0]?.skillId ?? 1)

  // Acumular groupAtkBonus de todos los héroes
  const totalGroupAtkBonus = heroes.reduce((sum, h) => sum + (h.groupAtkBonus ?? 0), 0)

  const levelReports: LevelReport[] = []

  for (const lvl of dungeon.levels) {
    addLog(log, 'level_start', 0, lvl.number, 'prelim',
      `━━━ Nivel ${lvl.number} — ${dungeon.name} ━━━`)

    const enemyUnits = lvl.enemies.map((e, i) => enemyToUnit(e, i))

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
      if (lvl.number === 1 && hero.combatProfile.prelimRules.length > 0) {
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

      addLog(log, 'round_start', round, lvl.number, 'combat',
        `── Ronda ${round} ──`)

      // Decaer buffs al inicio de ronda
      decayBuffs(state)

      // Contexto compartido de la ronda: mantiene idempotente el procesamiento de derrotas.
      const roundCtx: CombatCtx = { log, round, level: lvl.number, state, processedDeaths }

      // DoT al inicio de ronda
      for (const hu of heroUnits) processDotDamage(hu, hu.name, log, round, lvl.number, heroUnits, enemyUnits, roundCtx)
      for (const e of enemyUnits) processDotDamage(e, e.name, log, round, lvl.number, heroUnits, enemyUnits, roundCtx)

      applyManaRegen(heroUnits)

      // ─── Bonificaciones de facción ─────────────────
      applyFactionBonusesWrapper()

      applyDarknessHeal(enemyUnits, state, log, round, lvl.number)

      // ─── Pasivos de inicio de ronda ─────────────────
      processRoundStartPassives(heroUnits, enemyUnits, roundCtx)

      if (allHeroesDead(heroUnits)) break
      if (enemyUnits.filter(e => e.hp > 0).length === 0) {
        levelVictory = true
        break
      }

      if (processTrapsAutoWin(enemyUnits, log, round, lvl.number)) {
        levelVictory = true
        break
      }

      const queue = buildTurnQueue(heroUnits, enemyUnits)
      const roundActions: DetailedAction[] = []
      const totalActors = queue.length

      for (let ai = 0; ai < queue.length; ai++) {
        const actor = queue[ai]
        if (allHeroesDead(heroUnits)) break
        if (enemyUnits.filter(e => e.hp > 0).length === 0) break

        const actorUnit = resolveActorUnit(actor, heroUnits, enemyUnits)
        if (!actorUnit || actorUnit.hp <= 0) continue

        if (isUnitStunned(actorUnit)) {
          addLog(log, 'condition_change', round, lvl.number, 'combat',
            `${actorUnit.name} está ${actorUnit.statusEffects?.find(se => se.type === 'stun') ? 'aturdido' : 'congelado'} — salta turno`,
            { target: actorUnit.name })
          continue
        }

        if (actor.isHero) {
          const detail = runHeroTurn(actorUnit as CombatUnit & { attrs: Record<string, number> }, actor, heroes, heroUnits, enemyUnits, state, log, round, lvl.number, fallbackSkillId, ai, totalActors, roundActions)
          if (detail) roundActions.push(detail)
        } else {
          const detail = runEnemyTurn(actorUnit, lvl, heroUnits, state, log, round, lvl.number, ai, totalActors)
          if (detail) roundActions.push(detail)
        }
      }

      totalRounds++

      // Decaer efectos
      for (const hu of heroUnits) decayStatusEffects(hu)
      for (const e of enemyUnits) decayStatusEffects(e)

      decaySkillCooldowns(state)

      const stateAfter = buildStateSnapshot(heroUnits, enemyUnits, state.buffs, state.groupAtkBonus, state.groupDefBonus, state.factionBonuses)

      roundReports.push({
        roundNumber: round,
        stateBefore,
        stateAfter,
        actions: roundActions,
        narrative: generateRoundNarrative(round, roundActions),
      })

      if (enemyUnits.filter(e => e.hp > 0).length === 0) {
        levelVictory = true
        break
      }
      if (allHeroesDead(heroUnits)) break
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
      allLoot.push(...assignLootToHeroes(rollLoot(dungeon.lootTable), heroUnits))
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
    log,
    levelResults,
    levelReports,
  }
}

