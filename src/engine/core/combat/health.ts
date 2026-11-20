export interface HpChangeResult {
  readonly previousHp: number
  readonly currentHp: number
  readonly requested: number
  readonly applied: number
  readonly changed: boolean
  readonly defeated: boolean
  readonly defeatedNow: boolean
}

/** Applies non-negative damage with Wodos' existing zero-floor behavior. */
export function applyHpDamage(currentHp: number, damage: number): HpChangeResult {
  const safeDamage = Number.isFinite(damage) ? Math.max(0, damage) : 0
  const nextHp = Math.max(0, currentHp - safeDamage)
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

/** Applies non-negative healing with Wodos' existing maximum-HP ceiling behavior. */
export function applyHpHealing(currentHp: number, maxHp: number, healing: number): HpChangeResult {
  const safeHealing = Number.isFinite(healing) ? Math.max(0, healing) : 0
  const safeMaxHp = Number.isFinite(maxHp) ? Math.max(0, maxHp) : 0
  const nextHp = Math.min(safeMaxHp, currentHp + safeHealing)
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
