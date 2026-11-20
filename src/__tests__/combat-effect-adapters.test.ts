import { describe, expect, it } from 'vitest'
import {
  advanceLegacyCombatBuffs,
  advanceLegacyStatusRound,
  type LegacyCombatBuff,
  type LegacyCombatStatusEffect,
} from '@/engine/adapters'

describe('legacy combat effect lifecycle adapters', () => {
  it('advances statuses through the shared effect lifecycle and removes expired statuses', () => {
    const statuses: LegacyCombatStatusEffect[] = [
      { type: 'poison', remainingRounds: 2, value: 5, source: 'enemy-1', sourceName: 'Venom' },
      { type: 'stun', remainingRounds: 1, value: 0, source: 'enemy-2', sourceName: 'Freeze' },
      { type: 'atk_up', remainingRounds: 3, value: 10, source: 'hero-1', sourceName: 'Rally' },
    ]
    expect(advanceLegacyStatusRound(statuses)).toEqual([
      { ...statuses[0], remainingRounds: 1 },
      { ...statuses[2], remainingRounds: 2 },
    ])
    expect(statuses[0].remainingRounds).toBe(2)
  })

  it('advances finite buffs and preserves permanent buffs and metadata', () => {
    const buffs: LegacyCombatBuff[] = [
      { type: 'atk', value: 15, remainingRounds: 2, sourceName: 'Battle Cry', side: 'hero', icon: 'sword' },
      { type: 'def', value: 20, remainingRounds: 1, sourceName: 'Stone Skin', side: 'enemy' },
      { type: 'atk', value: 5, remainingRounds: null, sourceName: 'Aura', side: 'enemy' },
    ]
    expect(advanceLegacyCombatBuffs(buffs)).toEqual([
      { ...buffs[0], remainingRounds: 1 },
      buffs[2],
    ])
    expect(buffs[0].remainingRounds).toBe(2)
  })

  it('keeps status and buff domains isolated by target and combat side', () => {
    const buffs: LegacyCombatBuff[] = [
      { type: 'atk', value: 10, remainingRounds: 2, sourceName: 'Rally', side: 'hero' },
      { type: 'atk', value: 20, remainingRounds: 2, sourceName: 'Rally', side: 'enemy' },
    ]
    expect(advanceLegacyCombatBuffs(buffs)).toHaveLength(2)
    expect(advanceLegacyStatusRound([
      { type: 'poison', remainingRounds: 1, value: 4, source: 'a', sourceName: 'Poison' },
    ])).toEqual([])
  })
})
