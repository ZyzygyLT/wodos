import type { RandomSource } from '@/engine/core/random/random-source'
import { calculateDefenseBase, calculateInitiativeBase, calculateMaxHp, calculateMaxMp, resolveCritical, resolveFormulaDamage } from '@/engine/core'

// ─────────────────────────────────────────────────────────────────────────────
// IRONHOLD — Fórmulas de combate
// lib/combat-engine/formulas.ts
// ─────────────────────────────────────────────────────────────────────────────

export type DamageType =
  | 'physical' | 'fire' | 'ice' | 'lightning'
  | 'poison' | 'holy' | 'dark' | 'psychological'
  | 'piercing' | 'arcane' | 'healing' | 'bleed'

export interface HeroAttrs {
  st: number  // strength
  co: number  // constitution
  in: number  // intelligence
  dx: number  // dexterity
  ch: number  // charisma
  ag: number  // agility
  pe: number  // perception
  wi: number  // willpower
}

// ─── STATS DERIVADOS ─────────────────────────────────────────────────────────

export const calcHpMax = (attrs: HeroAttrs, level: number): number =>
  calculateMaxHp(attrs, level)

export const calcMpMax = (attrs: HeroAttrs): number =>
  calculateMaxMp(attrs)

export interface SkillFormula {
  attrCoeffs: Record<string, number>  // { st: 2, dx: 1 }
  skillRankCoeff: number              // 1.5 → daño extra por rango
  diceSides: number                   // 0 = sin dado
  diceCount: number                   // 1 = 1dX
  diceDivisor?: number                // controla dispersión: 1 + (dice - avg) / divisor (default: diceSides)
  flatBonus: number                   // bonus fijo
  damageType?: DamageType             // tipo de daño (default: physical)
  healPct?: number                    // % de HP max para skills de curación
}

/**
 * Evalúa la fórmula de una skill con los atributos y rango del héroe.
 * Retorna { base, diceTotal } para que calcActualDamage los use.
 */
export function evaluateFormula(
  formula: SkillFormula | undefined | null,
  attrs: Record<string, number>,
  skillRank: number,
  random: RandomSource = { next: () => Math.random() }
): { base: number; diceTotal: number } {
  if (!formula) return { base: 0, diceTotal: 0 }
  let base = formula.flatBonus ?? 0
  for (const [attr, coeff] of Object.entries(formula.attrCoeffs ?? {})) {
    base += (attrs[attr] ?? 0) * coeff
  }
  base += (skillRank ?? 1) * (formula.skillRankCoeff ?? 0)

  let diceTotal = 0
  const count = formula.diceCount ?? 0
  const sides = formula.diceSides ?? 0
  for (let i = 0; i < count; i++) {
    diceTotal += Math.floor(random.next() * Math.max(1, sides)) + 1
  }

  return { base: Math.max(0, base), diceTotal }
}

/**
 * Aplica multiplicador de dado centrado: base × (1 + (dice - avg) / divisor)
 * El resultado varía alrededor del base ~entre 50% y 150% para divisor = diceSides.
 */
export function applyDiceMultiplier(
  base: number,
  diceTotal: number,
  diceCount: number,
  diceSides: number,
  diceDivisor?: number
): number {
  if (diceTotal === 0 || diceCount === 0 || diceSides === 0) return base
  const avg = diceCount * (diceSides + 1) / 2
  const div = diceDivisor ?? diceSides * 1.5
  const mult = 1 + (diceTotal - avg) / Math.max(1, div)
  return Math.round(base * Math.max(0.3, mult))
}

export const calcDefenseBase = (attrs: HeroAttrs): number =>
  calculateDefenseBase(attrs)

export const calcInitiativeBase = (attrs: HeroAttrs): number =>
  calculateInitiativeBase(attrs)

// ─── ROLLS DE COMBATE ─────────────────────────────────────────────────────────

/**
 * Calcula daño real aplicando multiplicador de skill, bonus de grupo y defensa.
 * @param baseDmg  - Daño base del atacante (st + dx/2)
 * @param skillMult - Multiplicador de la habilidad usada (1.0 = básico, 1.8 = poderoso)
 * @param groupAtkBonus - Bonus grupal en % (0-100). Ej: 15 = +15%
 * @param targetDef - Defensa del objetivo
 */
/**
 * Calcula daño final aplicando el resultado de la fórmula, bonus de grupo y defensa.
 * @param formulaResult - { base, diceTotal } de evaluateFormula
 * @param groupAtkBonus - Bonus grupal en % (0-100)
 * @param targetDef - Defensa del objetivo
 * @param armorPen - Si es true, ignora parcialmente la defensa
 */
export const calcActualDamage = (
  adjustedBase: number,
  groupAtkBonus: number,
  targetDef: number,
  armorPen: boolean = false,
  damageType: DamageType = 'physical',
  resistances: Partial<Record<DamageType, number>> = {},
): number => {
  return resolveFormulaDamage({
    adjustedBase,
    groupAttackBonus: groupAtkBonus,
    targetDefense: targetDef,
    armorPenetration: armorPen,
    damageType,
    resistances,
  }).finalDamage
}

/**
 * Roll de crítico. Base 5%, +0.5% por punto de destreza.
 * Cap de 75%. Crítico aplica ×1.5 al daño calculado.
 */
export const rollCrit = (attackerDx: number, random: RandomSource = { next: () => Math.random() }): boolean =>
  resolveCritical({ attackerDexterity: attackerDx, random }).critical

export const CRIT_MULTIPLIER = 1.5

/**
 * Iniciativa final con componente aleatoria (+0 a +20).
 * Se recalcula cada ronda — el orden cambia ronda a ronda.
 */
export const rollInitiative = (base: number, random: RandomSource = { next: () => Math.random() }): number =>
  base + Math.floor(random.next() * 20)

// ─── HEALING ─────────────────────────────────────────────────────────────────

/**
 * Curación = % del HP máximo del objetivo.
 * El porcentaje viene definido en el efecto de la habilidad.
 */
export const calcHeal = (targetMaxHp: number, pct: number): number =>
  Math.round(targetMaxHp * (pct / 100))

// ─── CONDICIONES ─────────────────────────────────────────────────────────────

export type Condition = 'ready' | 'hurt' | 'critical' | 'down' | 'enraged'

export const getCondition = (hp: number, maxHp: number): Condition => {
  if (hp <= 0) return 'down'
  const pct = (hp / maxHp) * 100
  if (pct < 25) return 'critical'
  if (pct < 50) return 'hurt'
  return 'ready'
}

// ─── EP Y PROGRESIÓN ─────────────────────────────────────────────────────────
// Re-exportado eliminado: usar @/lib/level-up directamente

// ─── RECOMPENSAS DE DUNGEON ───────────────────────────────────────────────────

/**
 * Calcula recompensas con bonuses aplicados.
 * @param base      - Recompensa base del dungeon
 * @param groupBonus - Boolean: ¿hay bonus de grupo? (+15%)
 * @param victory   - Boolean: ¿victoria? (+20%)
 * @param firstOfDay - Boolean: ¿primera del día? (+30%)
 * @param defeat    - Boolean: ¿derrota? (-40%)
 */
export const calcReward = (
  base: number,
  options: {
    groupBonus?: boolean
    victory?: boolean
    firstOfDay?: boolean
    defeat?: boolean
    levelsCleared?: number
    totalLevels?: number
  }
): number => {
  let mult = 1
  if (options.groupBonus) mult *= 1.15
  if (options.victory) mult *= 1.2
  if (options.firstOfDay) mult *= 1.3
  if (options.defeat) {
    const partial = (options.levelsCleared || 0) / (options.totalLevels || 1)
    mult *= 0.4 + partial * 0.3  // entre 40% y 70% según progreso
  }
  return Math.round(base * mult)
}

// ─── ELO ARENA ────────────────────────────────────────────────────────────────

const K_STANDARD = 32
const K_HIGH = 16   // para jugadores >1400 ELO
const HIGH_ELO_THRESHOLD = 1400

export const expectedScore = (ratingA: number, ratingB: number): number =>
  1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))

export const calcEloChange = (
  rating: number,
  opponentRating: number,
  won: boolean
): number => {
  const K = rating > HIGH_ELO_THRESHOLD ? K_HIGH : K_STANDARD
  const expected = expectedScore(rating, opponentRating)
  const actual = won ? 1 : 0
  return Math.round(K * (actual - expected))
}
