export type CombatRoundStatus = 'continue' | 'heroes_defeated' | 'level_victory'

export interface CombatRoundStatusInput {
  livingHeroCount: number
  livingEnemyCount: number
  trapsAutoWin?: boolean
}

/**
 * Resolves round termination using the legacy dungeon-runner precedence:
 * hero defeat takes precedence over enemy defeat, then trap auto-win.
 */
export function resolveCombatRoundStatus(input: CombatRoundStatusInput): CombatRoundStatus {
  if (!Number.isSafeInteger(input.livingHeroCount) || input.livingHeroCount < 0) {
    throw new RangeError('livingHeroCount must be a non-negative safe integer')
  }
  if (!Number.isSafeInteger(input.livingEnemyCount) || input.livingEnemyCount < 0) {
    throw new RangeError('livingEnemyCount must be a non-negative safe integer')
  }
  if (input.livingHeroCount === 0) return 'heroes_defeated'
  if (input.livingEnemyCount === 0 || input.trapsAutoWin === true) return 'level_victory'
  return 'continue'
}
