export interface ClassicDerivedAttributes {
  readonly co: number
  readonly wi: number
  readonly in: number
  readonly ag: number
  readonly pe: number
}

export interface DerivedCombatStats {
  readonly hpMax: number
  readonly mpMax: number
  readonly defenseBase: number
  readonly initiativeBase: number
}

/** Wodos profile: HP = CON × 10 + level × 5. */
export function calculateMaxHp(attributes: Pick<ClassicDerivedAttributes, 'co'>, level: number): number {
  return attributes.co * 10 + level * 5
}

/** Wodos profile: MP = WIL × 8 + INT × 4. */
export function calculateMaxMp(attributes: Pick<ClassicDerivedAttributes, 'wi' | 'in'>): number {
  return attributes.wi * 8 + attributes.in * 4
}

/** Wodos profile: base defense = AGI × 2 + PER. */
export function calculateDefenseBase(attributes: Pick<ClassicDerivedAttributes, 'ag' | 'pe'>): number {
  return 2 * attributes.ag + attributes.pe
}

/** Wodos profile: base initiative = AGI + floor(PER / 2). */
export function calculateInitiativeBase(attributes: Pick<ClassicDerivedAttributes, 'ag' | 'pe'>): number {
  return attributes.ag + Math.floor(attributes.pe / 2)
}

export function calculateDerivedCombatStats(
  attributes: ClassicDerivedAttributes,
  level: number
): DerivedCombatStats {
  return {
    hpMax: calculateMaxHp(attributes, level),
    mpMax: calculateMaxMp(attributes),
    defenseBase: calculateDefenseBase(attributes),
    initiativeBase: calculateInitiativeBase(attributes),
  }
}
