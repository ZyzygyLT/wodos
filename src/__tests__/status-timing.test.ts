import { describe, expect, it } from 'vitest'
import { selectStatusEffectsForPhase } from '@/engine/core/effects/status-timing'

describe('status lifecycle phase selection', () => {
  const statuses = [
    { type: 'poison', value: 5 },
    { type: 'burn', value: 4 },
    { type: 'bleed', value: 3 },
    { type: 'stun', value: 0 },
    { type: 'freeze', value: 0 },
    { type: 'atk_up', value: 10 },
    { type: 'shield', value: 8 },
  ]

  it('selects periodic damage statuses at round start', () => {
    expect(selectStatusEffectsForPhase(statuses, 'round_start').map(status => status.type))
      .toEqual(['poison', 'burn', 'bleed'])
  })

  it('selects incapacitating statuses at actor turn', () => {
    expect(selectStatusEffectsForPhase(statuses, 'actor_turn').map(status => status.type))
      .toEqual(['stun', 'freeze'])
  })

  it('retains every status for round-end duration advancement', () => {
    expect(selectStatusEffectsForPhase(statuses, 'round_end')).toEqual(statuses)
  })

  it('returns an empty list when no status belongs to a phase', () => {
    expect(selectStatusEffectsForPhase([{ type: 'regen' }], 'round_start')).toEqual([])
    expect(selectStatusEffectsForPhase([{ type: 'shield' }], 'actor_turn')).toEqual([])
  })
})
