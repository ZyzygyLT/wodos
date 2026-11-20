export interface HpChangeResult {
  readonly previousHp: number
  readonly currentHp: number
  readonly requested: number
  readonly applied: number
  readonly changed: boolean
  readonly defeated: boolean
  readonly defeatedNow: boolean
}

/** Applies damage with Wodos' existing zero-floor behavior. */
export function applyHpDamage(currentHp: number, damage: number): HpChangeResult {
  const nextHp = Math.max(0, currentHp - damage)
  return {
    previousHp: currentHp,
    currentHp: nextHp,
    requested: damage,
    applied: currentHp - nextHp,
    changed: nextHp !== currentHp,
    defeated: nextHp <= 0,
    defeatedNow: currentHp > 0 && nextHp <= 0,
  }
}

/** Applies healing with Wodos' existing maximum-HP ceiling behavior. */
export function applyHpHealing(currentHp: number, maxHp: number, healing: number): HpChangeResult {
  const nextHp = Math.min(maxHp, currentHp + healing)
  return {
    previousHp: currentHp,
    currentHp: nextHp,
    requested: healing,
    applied: nextHp - currentHp,
    changed: nextHp !== currentHp,
    defeated: nextHp <= 0,
    defeatedNow: false,
  }
}
