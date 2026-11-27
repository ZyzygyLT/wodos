import { randomIntInclusive, type RandomSource } from '../random/random-source'

export type DefensiveReaction = 'dodge' | 'block' | 'barrier' | string | undefined

export interface IncomingDamageInput {
  readonly damage: number
  readonly defense?: DefensiveReaction
  readonly currentMp: number
  readonly random?: RandomSource
}

export interface IncomingDamageResult {
  readonly incomingDamage: number
  readonly finalDamage: number
  readonly absorbedByBarrier: number
  readonly dodged: boolean
  readonly mpSpent: number
}

/** Resolves Wodos' existing dodge, block and barrier reactions without mutating a unit. */
export function resolveIncomingDamage(input: IncomingDamageInput): IncomingDamageResult {
  const { damage, defense, currentMp } = input
  if (!defense || damage <= 0) {
    return { incomingDamage: damage, finalDamage: damage, absorbedByBarrier: 0, dodged: false, mpSpent: 0 }
  }
  if (defense === 'dodge') {
    if (!input.random) throw new Error('A RandomSource is required to resolve dodge')
    const roll = randomIntInclusive(input.random, 1, 6)
    const dodged = roll >= 5
    return { incomingDamage: damage, finalDamage: dodged ? 0 : damage, absorbedByBarrier: 0, dodged, mpSpent: 0 }
  }
  if (defense === 'block') {
    return { incomingDamage: damage, finalDamage: Math.floor(damage * 0.5), absorbedByBarrier: 0, dodged: false, mpSpent: 0 }
  }
  if (defense === 'barrier') {
    const absorbed = Math.min(currentMp, damage)
    return { incomingDamage: damage, finalDamage: damage - absorbed, absorbedByBarrier: absorbed, dodged: false, mpSpent: absorbed }
  }
  return { incomingDamage: damage, finalDamage: damage, absorbedByBarrier: 0, dodged: false, mpSpent: 0 }
}
