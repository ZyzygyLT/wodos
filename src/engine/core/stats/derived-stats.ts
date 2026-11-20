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


export interface EffectiveResourceMaximaInput {
  readonly baseHpMax: number
  readonly baseMpMax: number
  readonly level: number
  readonly baseAttributes: Readonly<Record<string, number>>
  readonly effectiveAttributes: Readonly<Record<string, number>>
  readonly equipmentHp?: number
  readonly equipmentMp?: number
  readonly skillEffects?: readonly (string | undefined)[]
}

/**
 * Resolves combat HP/MP maxima from persisted values, equipped classic attributes,
 * flat equipment bonuses and legacy resource passives in their original order.
 */
export function calculateEffectiveResourceMaxima(input: EffectiveResourceMaximaInput): {
  readonly hpMax: number
  readonly mpMax: number
} {
  const baseCo = input.baseAttributes.co ?? 0
  const effectiveCo = input.effectiveAttributes.co ?? baseCo
  const baseWi = input.baseAttributes.wi ?? 0
  const effectiveWi = input.effectiveAttributes.wi ?? baseWi
  const baseIn = input.baseAttributes.in ?? 0
  const effectiveIn = input.effectiveAttributes.in ?? baseIn

  let hpMax = input.baseHpMax
    + (Number.isFinite(input.equipmentHp) ? input.equipmentHp! : 0)
    + calculateMaxHp({ co: effectiveCo }, input.level)
    - calculateMaxHp({ co: baseCo }, input.level)
  let mpMax = input.baseMpMax
    + (Number.isFinite(input.equipmentMp) ? input.equipmentMp! : 0)
    + calculateMaxMp({ wi: effectiveWi, in: effectiveIn })
    - calculateMaxMp({ wi: baseWi, in: baseIn })

  for (const effect of input.skillEffects ?? []) {
    if (effect === 'hp_up') hpMax += Math.round(hpMax * 0.2)
    else if (effect === 'mp_up') mpMax += Math.round(mpMax * 0.2)
  }

  return { hpMax, mpMax }
}
