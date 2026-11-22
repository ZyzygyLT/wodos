import { describe, expect, it } from 'vitest'
import {
  applyStatModifiers,
  asEntityId,
  createSeededRandom,
  getAttributeValue,
  isExpired,
  randomIntInclusive,
  nextRandom,
  validateAttributes,
  type GameEffect,
  type StatModifier,
} from '@/engine/core'

describe('engine core foundation', () => {
  it('creates stable entity identifiers and rejects empty identifiers', () => {
    expect(asEntityId('hero-1')).toBe('hero-1')
    expect(() => asEntityId('  ')).toThrow('Entity id cannot be empty')
  })

  it('validates configurable attributes without fixed game-specific keys', () => {
    const definitions = [
      { key: 'strength', label: 'Strength', min: 1, max: 20, defaultValue: 5, integer: true },
      { key: 'focus', label: 'Focus', min: 0, max: 100, defaultValue: 10 },
    ]
    expect(validateAttributes({ strength: 21, focus: 1.5, agility: 4 }, definitions).map(issue => issue.code))
      .toEqual(['above_max', 'unknown'])
    expect(getAttributeValue({}, definitions[0])).toBe(5)
  })

  it('applies flat then percentage modifiers deterministically', () => {
    const modifiers: StatModifier[] = [
      { id: 'percent', stat: 'health', operation: 'percent', value: 10 },
      { id: 'flat', stat: 'health', operation: 'flat', value: 5 },
    ]
    expect(applyStatModifiers(100, modifiers)).toBeCloseTo(115)
    expect(applyStatModifiers(100, [...modifiers].reverse())).toBeCloseTo(115)
  })

  it('uses deterministic seeded random sequences', () => {
    const first = createSeededRandom(1234)
    const second = createSeededRandom(1234)
    const firstSequence = Array.from({ length: 5 }, () => first.next())
    const secondSequence = Array.from({ length: 5 }, () => second.next())
    expect(firstSequence).toEqual(secondSequence)
    expect(firstSequence.every(value => value >= 0 && value < 1)).toBe(true)
  })

  it('rolls inclusive integers and validates bounds', () => {
    expect(randomIntInclusive({ next: () => 0 }, 2, 4)).toBe(2)
    expect(randomIntInclusive({ next: () => 0.999999 }, 2, 4)).toBe(4)
    expect(() => randomIntInclusive({ next: () => 0.5 }, 4, 2)).toThrow(RangeError)
    expect(() => nextRandom({ next: () => -0.01 })).toThrow(RangeError)
    expect(() => nextRandom({ next: () => 1 })).toThrow(RangeError)
    expect(() => nextRandom({ next: () => Number.NaN })).toThrow(RangeError)
    expect(() => nextRandom({ next: () => Number.POSITIVE_INFINITY })).toThrow(RangeError)
  })

  it('identifies expired timed effects but not permanent effects', () => {
    const timed: GameEffect = {
      id: 'burn-1', kind: 'burn', targetId: asEntityId('hero-1'),
      duration: { type: 'rounds', remaining: 0 }, stacking: 'refresh', modifiers: [],
    }
    const permanent: GameEffect = {
      ...timed, id: 'blessing-1', duration: { type: 'permanent' },
    }
    expect(isExpired(timed)).toBe(true)
    expect(isExpired(permanent)).toBe(false)
  })
})
