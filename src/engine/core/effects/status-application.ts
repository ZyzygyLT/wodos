export type StatusApplicationType = 'poison' | 'burn' | 'bleed' | 'stun' | 'freeze'

export interface StatusApplication {
  readonly type: StatusApplicationType
  readonly value: number
  readonly rounds: number
}

/**
 * Resolves the status effect produced by a damage type.
 *
 * This is a pure rules function extracted from the legacy combat runner.
 * It deliberately preserves the existing Wodos coefficients, minimum damage
 * values, durations and damage-type fallbacks; applying the returned status
 * and emitting combat events remain adapter responsibilities.
 */
export function resolveStatusApplication(
  damageType: string,
  attackValue: number,
): StatusApplication | null {
  switch (damageType) {
    case 'poison': return { type: 'poison', value: Math.max(1, Math.round(attackValue * 0.15)), rounds: 3 }
    case 'fire': return { type: 'burn', value: Math.max(1, Math.round(attackValue * 0.2)), rounds: 2 }
    case 'ice': return { type: 'freeze', value: 0, rounds: 1 }
    case 'lightning': return { type: 'stun', value: 0, rounds: 1 }
    case 'holy': return { type: 'burn', value: Math.max(1, Math.round(attackValue * 0.25)), rounds: 2 }
    case 'psychological':
    case 'dark': return { type: 'stun', value: 0, rounds: 1 }
    case 'bleed':
    case 'piercing': return { type: 'bleed', value: Math.max(1, Math.round(attackValue * 0.1)), rounds: 3 }
    default: return null
  }
}
