import { describe, expect, it } from 'vitest'
import { normalizeLegacyCombatFormula } from '@/lib/dungeon-helpers'

const legacyFormula = {
  damageType: 'physical',
  diceCount: 1,
  diceSides: 6,
  diceDivisor: 2,
}

describe('normalizeLegacyCombatFormula', () => {
  it('restores a strength-based melee formula and applies the legacy skill multiplier', () => {
    const formula = normalizeLegacyCombatFormula(
      legacyFormula,
      'attack',
      ['melee'],
      1.2,
      { st: 16, ag: 5, dx: 7 },
    )

    expect(formula?.attrCoeffs).toEqual({ st: 1.44, dx: 0.72 })
    expect(formula?.skillRankCoeff).toBe(0)
    expect(formula?.flatBonus).toBe(0)
  })

  it('uses agility for an agile melee hero', () => {
    const formula = normalizeLegacyCombatFormula(
      legacyFormula,
      'attack',
      ['melee'],
      1.3,
      { st: 5, ag: 14, dx: 11 },
    )

    expect(formula?.attrCoeffs).toEqual({ ag: 1.56, dx: 0.78 })
  })

  it('uses dexterity and perception for ranged attacks', () => {
    const formula = normalizeLegacyCombatFormula(
      legacyFormula,
      'attack',
      ['ranged'],
      1.3,
      { dx: 14, pe: 7 },
    )

    expect(formula?.attrCoeffs).toEqual({ dx: 1.56, pe: 0.78 })
  })

  it('uses intelligence and willpower for magic attacks', () => {
    const formula = normalizeLegacyCombatFormula(
      { ...legacyFormula, damageType: 'arcane' },
      'attack',
      ['magic'],
      1.3,
      { in: 19, wi: 9 },
    )

    expect(formula?.attrCoeffs).toEqual({ in: 1.56, wi: 0.78 })
  })

  it('preserves formulas that already define an attribute-based damage model', () => {
    const explicitFormula = {
      attrCoeffs: { st: 2 },
      skillRankCoeff: 1,
      diceSides: 6,
      diceCount: 1,
      flatBonus: 3,
    }

    expect(
      normalizeLegacyCombatFormula(explicitFormula, 'attack', ['melee'], 2, { st: 10, dx: 5 }),
    ).toBe(explicitFormula)
  })

  it('does not alter support formulas', () => {
    const healFormula = { healPct: 25, damageType: 'light' }

    expect(
      normalizeLegacyCombatFormula(healFormula, 'heal', ['heal'], 1, { in: 10, wi: 10 }),
    ).toBe(healFormula)
  })
})
