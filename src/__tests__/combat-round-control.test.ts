import { describe, expect, it } from 'vitest'
import { resolveCombatRoundStatus } from '@/engine/core/combat/round-control'

describe('combat round control', () => {
  it('continues while both sides have living units', () => {
    expect(resolveCombatRoundStatus({ livingHeroCount: 2, livingEnemyCount: 3 })).toBe('continue')
  })

  it('marks the level as a victory when all enemies are defeated', () => {
    expect(resolveCombatRoundStatus({ livingHeroCount: 1, livingEnemyCount: 0 })).toBe('level_victory')
  })

  it('prioritizes hero defeat when both sides have no living units', () => {
    expect(resolveCombatRoundStatus({ livingHeroCount: 0, livingEnemyCount: 0 })).toBe('heroes_defeated')
  })

  it('preserves trap auto-win after checking hero survival', () => {
    expect(resolveCombatRoundStatus({ livingHeroCount: 1, livingEnemyCount: 2, trapsAutoWin: true })).toBe('level_victory')
    expect(resolveCombatRoundStatus({ livingHeroCount: 0, livingEnemyCount: 2, trapsAutoWin: true })).toBe('heroes_defeated')
  })

  it('rejects invalid living-unit counts', () => {
    expect(() => resolveCombatRoundStatus({ livingHeroCount: -1, livingEnemyCount: 1 })).toThrow(RangeError)
    expect(() => resolveCombatRoundStatus({ livingHeroCount: 1.5, livingEnemyCount: 1 })).toThrow(RangeError)
    expect(() => resolveCombatRoundStatus({ livingHeroCount: 1, livingEnemyCount: Number.NaN })).toThrow(RangeError)
  })
})
