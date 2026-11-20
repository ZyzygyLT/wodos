import { randomIntInclusive, type RandomSource } from '../random/random-source'

/** Runtime-neutral formula contract. Game-specific damage types remain string identifiers. */
export interface SkillFormulaDefinition {
  readonly attrCoeffs: Readonly<Record<string, number>>
  readonly skillRankCoeff: number
  readonly diceSides: number
  readonly diceCount: number
  readonly diceDivisor?: number
  readonly flatBonus: number
  readonly damageType?: string
  readonly healPct?: number
}

export interface SkillDefinition {
  readonly id: number
  readonly name: string
  readonly effect: string
  readonly timing: string
  readonly manaCost: number
  readonly multiplier: number
  readonly cooldownRounds?: number
  readonly requiresSkills?: readonly number[]
  readonly tags?: readonly string[]
  readonly formula?: SkillFormulaDefinition | null
}

export interface SkillValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
}

export interface SkillFormulaResult {
  readonly base: number
  readonly diceTotal: number
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export function validateSkillFormula(formula: SkillFormulaDefinition): SkillValidationResult {
  const errors: string[] = []

  if (!formula || typeof formula !== 'object') {
    return { valid: false, errors: ['formula must be an object'] }
  }

  if (!formula.attrCoeffs || typeof formula.attrCoeffs !== 'object' || Array.isArray(formula.attrCoeffs)) {
    errors.push('formula.attrCoeffs must be an object')
  } else {
    for (const [attribute, coefficient] of Object.entries(formula.attrCoeffs)) {
      if (!attribute.trim()) errors.push('formula attribute keys cannot be empty')
      if (!isFiniteNumber(coefficient)) errors.push(`formula.attrCoeffs.${attribute} must be finite`)
    }
  }

  for (const key of ['skillRankCoeff', 'diceSides', 'diceCount', 'flatBonus'] as const) {
    if (!isFiniteNumber(formula[key])) errors.push(`formula.${key} must be finite`)
  }
  if (formula.diceSides < 0 || !Number.isInteger(formula.diceSides)) {
    errors.push('formula.diceSides must be a non-negative integer')
  }
  if (formula.diceCount < 0 || !Number.isInteger(formula.diceCount)) {
    errors.push('formula.diceCount must be a non-negative integer')
  }
  if (formula.diceCount > 0 && formula.diceSides < 1) {
    errors.push('formula.diceSides must be positive when diceCount is greater than zero')
  }
  if (formula.diceDivisor !== undefined && (!isFiniteNumber(formula.diceDivisor) || formula.diceDivisor <= 0)) {
    errors.push('formula.diceDivisor must be a positive finite number')
  }
  if (formula.healPct !== undefined && !isFiniteNumber(formula.healPct)) {
    errors.push('formula.healPct must be finite')
  }

  return { valid: errors.length === 0, errors }
}

export function validateSkillDefinition(skill: SkillDefinition): SkillValidationResult {
  const errors: string[] = []

  if (!Number.isSafeInteger(skill.id) || skill.id <= 0) errors.push('skill.id must be a positive safe integer')
  if (typeof skill.name !== 'string' || !skill.name.trim()) errors.push('skill.name is required')
  if (typeof skill.effect !== 'string' || !skill.effect.trim()) errors.push('skill.effect is required')
  if (typeof skill.timing !== 'string' || !skill.timing.trim()) errors.push('skill.timing is required')
  if (!isFiniteNumber(skill.manaCost) || skill.manaCost < 0) errors.push('skill.manaCost must be a non-negative finite number')
  if (!isFiniteNumber(skill.multiplier) || skill.multiplier < 0) errors.push('skill.multiplier must be a non-negative finite number')
  if (skill.cooldownRounds !== undefined && (!Number.isInteger(skill.cooldownRounds) || skill.cooldownRounds < 0)) {
    errors.push('skill.cooldownRounds must be a non-negative integer')
  }
  if (skill.requiresSkills?.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    errors.push('skill.requiresSkills must contain positive safe integers')
  }
  if (skill.tags?.some(tag => typeof tag !== 'string' || !tag.trim())) {
    errors.push('skill.tags must contain non-empty strings')
  }
  if (skill.formula) errors.push(...validateSkillFormula(skill.formula).errors)

  return { valid: errors.length === 0, errors }
}

/** Evaluates the existing Wodos attribute + rank + dice formula without application dependencies. */
export function evaluateSkillFormula(
  formula: SkillFormulaDefinition | undefined | null,
  attributes: Readonly<Record<string, number>>,
  skillRank: number,
  random: RandomSource = { next: () => Math.random() },
): SkillFormulaResult {
  if (!formula) return { base: 0, diceTotal: 0 }

  // Legacy persisted JSON may omit formula members; retain the former zero/empty defaults.
  const normalized: SkillFormulaDefinition = {
    attrCoeffs: formula.attrCoeffs ?? {},
    skillRankCoeff: formula.skillRankCoeff ?? 0,
    diceSides: formula.diceSides ?? 0,
    diceCount: formula.diceCount ?? 0,
    diceDivisor: formula.diceDivisor,
    flatBonus: formula.flatBonus ?? 0,
    damageType: formula.damageType,
    healPct: formula.healPct,
  }
  const validation = validateSkillFormula(normalized)
  if (!validation.valid) {
    throw new RangeError(`Invalid skill formula: ${validation.errors.join('; ')}`)
  }

  let base = normalized.flatBonus
  for (const [attribute, coefficient] of Object.entries(normalized.attrCoeffs)) {
    base += (attributes[attribute] ?? 0) * coefficient
  }
  base += (skillRank ?? 1) * normalized.skillRankCoeff

  let diceTotal = 0
  for (let index = 0; index < normalized.diceCount; index += 1) {
    diceTotal += randomIntInclusive(random, 1, Math.max(1, normalized.diceSides))
  }

  return { base: Math.max(0, base), diceTotal }
}

/** Applies Wodos' centered dice multiplier; retained as a pure engine operation. */
export function applySkillDiceMultiplier(
  base: number,
  diceTotal: number,
  diceCount: number,
  diceSides: number,
  diceDivisor?: number,
): number {
  if (diceTotal === 0 || diceCount === 0 || diceSides === 0) return base
  const average = diceCount * (diceSides + 1) / 2
  const divisor = diceDivisor ?? diceSides * 1.5
  const multiplier = 1 + (diceTotal - average) / Math.max(1, divisor)
  return Math.round(base * Math.max(0.3, multiplier))
}
