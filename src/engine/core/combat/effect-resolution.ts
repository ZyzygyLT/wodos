export interface ManaShieldInput {
  readonly enabled: boolean
  readonly currentMp: number
  readonly incomingDamage: number
}

export interface ManaShieldResult {
  readonly absorbed: number
  readonly remainingDamage: number
  readonly mpRemaining: number
}

/** Resolves mana-shield arithmetic without mutating combat state or emitting events. */
export function resolveManaShield(input: ManaShieldInput): ManaShieldResult {
  const { enabled, currentMp, incomingDamage } = input
  if (!enabled || currentMp <= 0 || incomingDamage <= 0) {
    return { absorbed: 0, remainingDamage: incomingDamage, mpRemaining: currentMp }
  }
  const absorbed = Math.min(currentMp, incomingDamage)
  return {
    absorbed,
    remainingDamage: incomingDamage - absorbed,
    mpRemaining: currentMp - absorbed,
  }
}

export interface ThornsInput {
  readonly enabled: boolean
  readonly incomingDamage: number
  readonly reflectionPercent: number
  readonly attackerAlive: boolean
}

/** Calculates reflected damage; caller remains responsible for applying it and handling defeat. */
export function calculateThornsDamage(input: ThornsInput): number {
  if (!input.enabled || input.incomingDamage <= 0 || !input.attackerAlive) return 0
  return Math.max(1, Math.round(input.incomingDamage * input.reflectionPercent / 100))
}

/** Caps healing at max HP and returns the actual amount, leaving unit mutation to the adapter. */
export function calculateEffectiveHealing(currentHp: number, maxHp: number, requestedHealing: number): number {
  return Math.min(requestedHealing, maxHp - currentHp)
}
