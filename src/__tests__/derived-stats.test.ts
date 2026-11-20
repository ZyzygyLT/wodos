import { describe, expect, it } from 'vitest'
import { calculateEffectiveResourceMaxima } from '@/engine/core/stats/derived-stats'

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
