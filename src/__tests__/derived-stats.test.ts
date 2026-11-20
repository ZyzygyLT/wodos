import { describe, expect, it } from 'vitest'
import { applyInitiativeSkillModifiers, calculateEffectiveResourceMaxima, calculateInitiativeBase } from '@/engine/core/stats/derived-stats'

describe('calculateEffectiveResourceMaxima', () => {
  it('includes equipped classic attributes, flat resource bonuses and sequential passives', () => {
    expect(calculateEffectiveResourceMaxima({
      baseHpMax: 100,
      baseMpMax: 80,
      level: 5,
      baseAttributes: { co: 10, wi: 10, in: 10 },
      effectiveAttributes: { co: 12, wi: 11, in: 12 },
      equipmentHp: 5,
      equipmentMp: 3,
      skillEffects: ['hp_up', 'mp_up', 'hp_up'],
    })).toEqual({ hpMax: 180, mpMax: 119 })
  })

  it('keeps persisted maxima when no equipment or resource passives change them', () => {
    expect(calculateEffectiveResourceMaxima({
      baseHpMax: 125,
      baseMpMax: 90,
      level: 8,
      baseAttributes: { co: 10, wi: 8, in: 7 },
      effectiveAttributes: { co: 10, wi: 8, in: 7 },
    })).toEqual({ hpMax: 125, mpMax: 90 })
  })
})

describe('initiative derived stats', () => {
  it('applies each speed_up passive exactly once to effective AGI', () => {
    const base = { ag: 10, pe: 9, dx: 7 }
    const effective = applyInitiativeSkillModifiers(base, ['speed_up', 'accuracy_up', 'speed_up'])

    expect(effective).toEqual({ ag: 20, pe: 9, dx: 7 })
    expect(base.ag).toBe(10)
    expect(calculateInitiativeBase(effective)).toBe(24)
  })

  it('neutralizes non-finite AGI and PER instead of poisoning turn ordering', () => {
    expect(calculateInitiativeBase({ ag: Number.NaN, pe: 10 })).toBe(5)
    expect(calculateInitiativeBase({ ag: 12, pe: Number.POSITIVE_INFINITY })).toBe(12)
    expect(calculateInitiativeBase({ ag: Number.NaN, pe: Number.NaN })).toBe(0)
  })

  it('neutralizes non-finite AGI before applying speed passives', () => {
    expect(applyInitiativeSkillModifiers({ ag: Number.NaN, pe: 8 }, ['speed_up']).ag).toBe(5)
  })
})
