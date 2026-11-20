import { describe, expect, it } from 'vitest'
import {
  applySkillDiceMultiplier,
  evaluateSkillFormula,
  validateSkillDefinition,
  validateSkillFormula,
  type SkillDefinition,
  type SkillFormulaDefinition,
} from '@/engine/core/skills/skill-definition'

const formula: SkillFormulaDefinition = {
  attrCoeffs: { st: 2, dx: 1 },
  skillRankCoeff: 1.5,
  diceSides: 6,
  diceCount: 2,
  flatBonus: 3,
  damageType: 'physical',
}

const skill: SkillDefinition = {
  id: 12,
  name: 'Heavy Strike',
  effect: 'attack',
  timing: 'round',
  manaCost: 5,
  multiplier: 1.4,
  cooldownRounds: 2,
  requiresSkills: [3],
  tags: ['melee'],
  formula,
}

describe('engine skill definitions and formulas', () => {
  it('accepts a valid normalized skill definition', () => {
    expect(validateSkillDefinition(skill)).toEqual({ valid: true, errors: [] })
  })

  it('reports invalid costs, identifiers and cooldowns', () => {
    const result = validateSkillDefinition({
      ...skill,
      id: 0,
      manaCost: -1,
      multiplier: Number.NaN,
      cooldownRounds: -2,
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(expect.arrayContaining([
      'skill.id must be a positive safe integer',
      'skill.manaCost must be a non-negative finite number',
      'skill.multiplier must be a non-negative finite number',
      'skill.cooldownRounds must be a non-negative integer',
    ]))
  })

  it('validates dice and coefficients before evaluating a formula', () => {
    const invalid = { ...formula, diceCount: 1, diceSides: 0, diceDivisor: -1 }
    expect(validateSkillFormula(invalid).valid).toBe(false)
    expect(() => evaluateSkillFormula(invalid, { st: 10 }, 1, { next: () => 0 }))
      .toThrow(RangeError)
  })

  it('evaluates attributes, rank and deterministic dice', () => {
    const result = evaluateSkillFormula(formula, { st: 10, dx: 4 }, 2, { next: () => 0 })
    expect(result).toEqual({ base: 30, diceTotal: 2 })
  })

  it('preserves the existing centered dice multiplier', () => {
    expect(applySkillDiceMultiplier(100, 7, 2, 6)).toBe(100)
    expect(applySkillDiceMultiplier(100, 0, 2, 6)).toBe(100)
  })
})
