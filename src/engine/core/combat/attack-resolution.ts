import { nextRandom, type RandomSource }

export interface CriticalChanceInput {
  readonly attackerDexterity: number
  readonly random: RandomSource
  readonly forced?: boolean
}

export interface AttackHitInput {
  readonly attackTotal: number
  readonly defenseValue: number
}

export interface AttackHitResult {
  readonly hit: boolean
  readonly margin: number
}

export interface CriticalResult {
  readonly critical: boolean
  readonly chance: number
  readonly roll?: number
}

/** Wodos' current critical chance: 5% + 0.5% per DX, capped at 75%. */
export function calculateCriticalChance(attackerDexterity: number): number {
  return Math.min(0.75, 0.05 + attackerDexterity * 0.005)
}

/** Resolves a critical roll without coupling the engine to Math.random. */
export function resolveCritical(input: CriticalChanceInput): CriticalResult {
  if (input.forced) return { critical: true, chance: 1 }
  const chance = calculateCriticalChance(input.attackerDexterity)
  const roll = nextRandom(input.random)
  return { critical: roll < chance, chance, roll }
}

/** A hit occurs when attack total is equal to or greater than defense. */
export function resolveAttackHit(input: AttackHitInput): AttackHitResult {
  const margin = input.attackTotal - input.defenseValue
  return { hit: margin >= 0, margin }
}
