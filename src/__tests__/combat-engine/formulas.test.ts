import { describe, it, expect, vi, beforeEach } from 'vitest'

// Seed Math.random for deterministic tests
function seedRandom(values: number[]) {
  let i = 0
  vi.spyOn(Math, 'random').mockImplementation(() => {
    const v = values[i % values.length]
    i++
    return v
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
})

const { calcHpMax, calcMpMax, evaluateFormula, calcDefenseBase, calcInitiativeBase, calcActualDamage, rollCrit, CRIT_MULTIPLIER, rollInitiative, calcHeal, getCondition, calcReward, expectedScore, calcEloChange } = await import('@/lib/combat-engine/formulas')
const { totalEpForLevel, levelFromEp } = await import('@/lib/level-up')
const epRequiredForLevel = totalEpForLevel

const baseAttrs = { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 }

describe('calcHpMax', () => {
  it('returns co * 10 + level * 5', () => {
    expect(calcHpMax({ ...baseAttrs, co: 8 }, 1)).toBe(8 * 10 + 1 * 5)
  })

  it('scales with level', () => {
    expect(calcHpMax(baseAttrs, 50)).toBe(10 * 10 + 50 * 5)
  })

  it('works with zero constitution', () => {
    expect(calcHpMax({ ...baseAttrs, co: 0 }, 1)).toBe(0 + 5)
  })
})

describe('calcMpMax', () => {
  it('returns wi * 8 + in * 4', () => {
    expect(calcMpMax({ ...baseAttrs, wi: 12, in: 15 })).toBe(12 * 8 + 15 * 4)
  })

  it('works with zero values', () => {
    expect(calcMpMax({ ...baseAttrs, wi: 0, in: 0 })).toBe(0)
  })
})

describe('calcDefenseBase', () => {
  it('returns 2*ag + pe', () => {
    expect(calcDefenseBase({ ...baseAttrs, ag: 14, pe: 8 })).toBe(28 + 8)
  })
})

describe('calcInitiativeBase', () => {
  it('returns ag + floor(pe/2)', () => {
    expect(calcInitiativeBase({ ...baseAttrs, ag: 12, pe: 9 })).toBe(12 + 4)
  })
})

describe('evaluateFormula', () => {
  it('returns 0 base/dice for null/undefined formula', () => {
    expect(evaluateFormula(null, {}, 1)).toEqual({ base: 0, diceTotal: 0 })
    expect(evaluateFormula(undefined, {}, 1)).toEqual({ base: 0, diceTotal: 0 })
  })

  it('evaluates attr coefficients', () => {
    const formula = { attrCoeffs: { st: 2, dx: 1 }, skillRankCoeff: 0, diceSides: 0, diceCount: 0, diceDivisor: 0, flatBonus: 0 }
    const result = evaluateFormula(formula, { st: 10, dx: 8 }, 1)
    expect(result.base).toBe(10 * 2 + 8 * 1)
  })

  it('adds skill rank coefficient', () => {
    const formula = { attrCoeffs: { st: 1 }, skillRankCoeff: 3, diceSides: 0, diceCount: 0, diceDivisor: 0, flatBonus: 0 }
    const result = evaluateFormula(formula, { st: 10 }, 5)
    expect(result.base).toBe(10 + 5 * 3)
  })

  it('adds flat bonus', () => {
    const formula = { attrCoeffs: {}, skillRankCoeff: 0, diceSides: 0, diceCount: 0, diceDivisor: 0, flatBonus: 50 }
    expect(evaluateFormula(formula, {}, 1).base).toBe(50)
  })

  it('rolls dice correctly', () => {
    seedRandom([0, 0.5])
    const formula = { attrCoeffs: {}, skillRankCoeff: 0, diceSides: 10, diceCount: 2, diceDivisor: 10, flatBonus: 0 }
    const result = evaluateFormula(formula, {}, 1)
    expect(result.diceTotal).toBeGreaterThanOrEqual(2)
    expect(result.diceTotal).toBeLessThanOrEqual(20)
  })

  it('base is never negative', () => {
    const formula = { attrCoeffs: { st: -1 }, skillRankCoeff: 0, diceSides: 0, diceCount: 0, diceDivisor: 0, flatBonus: 0 }
    expect(evaluateFormula(formula, { st: 100 }, 1).base).toBe(0)
  })
})

describe('calcActualDamage', () => {
  it('applies group bonus and reduces by defense', () => {
    const dmg = calcActualDamage(100, 10, 30)
    // raw = 100 * 1.10 = 110; effective = 110 - 30*0.8 = 110 - 24 = 86
    expect(dmg).toBe(86)
  })

  it('minimum damage is 1', () => {
    expect(calcActualDamage(0, 0, 9999)).toBe(1)
  })

  it('armorPen ignores 70% of defense', () => {
    const normal = calcActualDamage(100, 0, 100, false)
    const withPen = calcActualDamage(100, 0, 100, true)
    expect(withPen).toBeGreaterThan(normal)
  })
})

describe('rollCrit', () => {
  it('crits when random < 0.05 + dx*0.005', () => {
    seedRandom([0])
    expect(rollCrit(10)).toBe(true)  // 0.05 + 10*0.005 = 0.10
  })

  it('no crit when above threshold', () => {
    seedRandom([0.99])
    expect(rollCrit(10)).toBe(false)
  })
})

describe('CRIT_MULTIPLIER', () => {
  it('is 1.5', () => {
    expect(CRIT_MULTIPLIER).toBe(1.5)
  })
})

describe('rollInitiative', () => {
  it('adds 0-19 to base', () => {
    seedRandom([0, 0.5, 0.99])
    expect(rollInitiative(10)).toBe(10)          // floor(0.0 * 20) = 0
    expect(rollInitiative(10)).toBe(20)          // floor(0.5 * 20) = 10
    expect(rollInitiative(10)).toBe(29)          // floor(0.99 * 20) = 19
  })
})

describe('calcHeal', () => {
  it('rounds percentage of maxHp', () => {
    expect(calcHeal(1000, 25)).toBe(250)
    expect(calcHeal(1000, 33)).toBe(330)
    expect(calcHeal(500, 10)).toBe(50)
  })
})

describe('getCondition', () => {
  it('returns down when hp <= 0', () => {
    expect(getCondition(0, 100)).toBe('down')
    expect(getCondition(-5, 100)).toBe('down')
  })

  it('returns critical when hp < 25%', () => {
    expect(getCondition(24, 100)).toBe('critical')
    expect(getCondition(1, 100)).toBe('critical')
  })

  it('returns hurt when hp < 50%', () => {
    expect(getCondition(49, 100)).toBe('hurt')
    expect(getCondition(25, 100)).toBe('hurt')
  })

  it('returns ready when hp >= 50%', () => {
    expect(getCondition(50, 100)).toBe('ready')
    expect(getCondition(100, 100)).toBe('ready')
  })
})

describe('epRequiredForLevel', () => {
  it('level 1 needs 0 EP', () => {
    expect(epRequiredForLevel(1)).toBe(0)
  })

  it('level 2 needs 200 EP', () => {
    expect(epRequiredForLevel(2)).toBe(200)
  })

  it('level 3 needs 200 + 320 = 520', () => {
    expect(epRequiredForLevel(3)).toBe(200 + 320)
  })

  it('scales exponentially', () => {
    const l10 = epRequiredForLevel(10)
    expect(l10).toBeGreaterThan(10000)
  })
})

describe('levelFromEp', () => {
  it('returns 1 for 0 EP', () => {
    expect(levelFromEp(0)).toBe(1)
  })

  it('returns 1 for 199 EP', () => {
    expect(levelFromEp(199)).toBe(1)
  })

  it('returns 2 for 200 EP', () => {
    expect(levelFromEp(200)).toBe(2)
  })

  it('returns higher levels for more EP', () => {
    const l3 = epRequiredForLevel(3)
    expect(levelFromEp(l3)).toBe(3)  // epForLevel(3) <= 520 → level=3
    expect(levelFromEp(l3 + 1)).toBe(3)
    expect(levelFromEp(epRequiredForLevel(4))).toBe(4)
  })
})

describe('calcReward', () => {
  it('returns base with no modifiers', () => {
    expect(calcReward(100, {})).toBe(100)
  })

  it('applies group bonus', () => {
    expect(calcReward(100, { groupBonus: true })).toBe(115)
  })

  it('applies victory bonus', () => {
    expect(calcReward(100, { victory: true })).toBe(120)
  })

  it('applies firstOfDay bonus', () => {
    expect(calcReward(100, { firstOfDay: true })).toBe(130)
  })

  it('stacks all bonuses multiplicatively', () => {
    const r = calcReward(100, { groupBonus: true, victory: true, firstOfDay: true })
    expect(r).toBe(179)  // 100 * 1.15 * 1.20 * 1.30 = 179.4 -> 179
  })

  it('defeat gives 40-70% based on progress', () => {
    const fullClear = calcReward(100, { defeat: true, levelsCleared: 5, totalLevels: 5 })
    // 0.4 + 1.0 * 0.3 = 0.7 -> 70
    expect(fullClear).toBe(70)

    const partial = calcReward(100, { defeat: true, levelsCleared: 2, totalLevels: 5 })
    // 0.4 + 0.4 * 0.3 = 0.52 -> 52
    expect(partial).toBe(52)
  })
})

describe('expectedScore', () => {
  it('equal ratings give 0.5', () => {
    expect(expectedScore(1200, 1200)).toBeCloseTo(0.5, 2)
  })

  it('higher rating gives higher expected score', () => {
    expect(expectedScore(1600, 1200)).toBeGreaterThan(0.5)
    expect(expectedScore(1200, 1600)).toBeLessThan(0.5)
  })
})

describe('calcEloChange', () => {
  it('win against equal rating gains +16 (K=32)', () => {
    const change = calcEloChange(1200, 1200, true)
    expect(change).toBe(16)
  })

  it('loss against equal rating loses -16', () => {
    const change = calcEloChange(1200, 1200, false)
    expect(change).toBe(-16)
  })

  it('uses K=16 above 1400', () => {
    const change = calcEloChange(1500, 1500, true)
    expect(change).toBe(8)  // 16 * (1 - 0.5) = 8
  })

  it('win against higher rating gains more', () => {
    const winVsHigher = calcEloChange(1200, 1600, true)
    const winVsLower = calcEloChange(1200, 800, true)
    expect(winVsHigher).toBeGreaterThan(winVsLower)
  })
})
