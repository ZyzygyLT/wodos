import type { RandomSource } from '../random/random-source'

export interface CombatSkillFormula {
  readonly attrCoeffs?: Readonly<Record<string, number>>
  readonly skillRankCoeff?: number
  readonly diceSides?: number
  readonly diceCount?: number
  readonly flatBonus?: number
}

export interface DefenseSkill {
  readonly skillId?: number
  readonly rank?: number
  readonly formula?: CombatSkillFormula | null
  readonly skill?: {
    readonly id?: number
    readonly formula?: CombatSkillFormula | null
  } | null
}

export interface DefenseProfile {
  readonly defenseSkills?: Readonly<Record<string, number | null>> | null
}

export interface DefenseCalculationInput {
  readonly attributes: Readonly<Record<string, number>>
  readonly baseAttributes?: Readonly<Record<string, number>>
  readonly profile?: DefenseProfile | null
  readonly skills?: readonly DefenseSkill[]
  readonly random?: RandomSource
  readonly categories?: readonly string[]
}

export interface DefenseCalculationResult {
  readonly values: Readonly<Record<string, number>>
  readonly breakdown: Readonly<Record<string, readonly string[]>>
}

function nextRandom(random?: RandomSource): number {
  return random?.next() ?? Math.random()
}

/** Pure Wodos-compatible defense calculation; randomness can be injected for replay/tests. */
export function calculateDefense(input: DefenseCalculationInput): DefenseCalculationResult {
  const categories = input.categories ?? ['melee', 'ranged', 'magic']
  const defenseSkills = input.profile?.defenseSkills ?? {}
  const values: Record<string, number> = {}
  const breakdown: Record<string, string[]> = {}

  for (const category of categories) {
    const skillId = defenseSkills[category]
    const heroSkill = skillId
      ? input.skills?.find(skill => skill.skillId === skillId || skill.skill?.id === skillId)
      : undefined
    const formula = heroSkill?.skill?.formula ?? heroSkill?.formula
    const lines: string[] = []

    if (heroSkill && formula) {
      for (const [attribute, coefficient] of Object.entries(formula.attrCoeffs ?? {})) {
        const value = input.attributes[attribute] ?? 0
        const baseValue = input.baseAttributes?.[attribute] ?? 0
        const equipmentValue = value - baseValue
        lines.push(`${attribute}=${baseValue}${equipmentValue > 0 ? '+' + equipmentValue + '(eq)' : ''} × ${coefficient} = ${Math.round(value * coefficient)}`)
      }
      const rank = heroSkill.rank ?? 1
      const rankTerm = (formula.skillRankCoeff ?? 0) * rank
      if (rankTerm > 0) lines.push(`rango × ${formula.skillRankCoeff} = ${rankTerm}`)
      const flat = formula.flatBonus ?? 0
      if (flat > 0) lines.push(`base +${flat}`)

      let base = flat
      for (const [attribute, coefficient] of Object.entries(formula.attrCoeffs ?? {})) {
        base += (input.attributes[attribute] ?? 0) * coefficient
      }
      base += rankTerm
      base = Math.max(0, base)
      let diceTotal = 0
      const diceCount = formula.diceCount ?? 0
      const diceSides = formula.diceSides ?? 0
      for (let i = 0; i < diceCount; i++) {
        diceTotal += Math.floor(nextRandom(input.random) * Math.max(1, diceSides)) + 1
      }
      values[category] = Math.max(1, base + diceTotal)
    } else {
      const dexterity = input.attributes.dx ?? 5
      const fallback = dexterity * 2
      lines.push(`dx=${input.attributes.dx} × 2 = ${fallback}`)
      values[category] = fallback
    }

    breakdown[category] = lines
  }

  return { values, breakdown }
}
