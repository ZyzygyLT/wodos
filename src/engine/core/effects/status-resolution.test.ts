import { describe, expect, it } from 'vitest'
import {
  calculatePeriodicStatusDamage,
  isTurnPreventedByStatus,
} from './status-resolution'

describe('pure status effect resolution', () => {
  it('sums poison, burn and bleed values without including other statuses', () => {
    expect(calculatePeriodicStatusDamage([
      { type: 'poison', value: 4 },
      { type: 'burn', value: 3 },
      { type: 'bleed', value: 2 },
      { type: 'stun', value: 100 },
      { type: 'freeze', value: 100 },
      { type: 'atk_up', value: 100 },
    ])).toBe(9)
  })

  it('returns zero when no periodic damage status is present', () => {
    expect(calculatePeriodicStatusDamage([])).toBe(0)
    expect(calculatePeriodicStatusDamage([
      { type: 'stun', value: 5 },
      { type: 'regen', value: 8 },
    ])).toBe(0)
  })

  it('recognizes stun and freeze as turn-preventing statuses', () => {
    expect(isTurnPreventedByStatus([{ type: 'stun' }])).toBe(true)
    expect(isTurnPreventedByStatus([{ type: 'freeze' }])).toBe(true)
    expect(isTurnPreventedByStatus([{ type: 'poison' }, { type: 'burn' }])).toBe(false)
    expect(isTurnPreventedByStatus([])).toBe(false)
  })
})
