import { asEntityId, calculateDefense, calculateStats } from '@/engine/core'
import { equippedItemsToModifiers, type PersistedHeroItem } from '@/engine/adapters'
import type { SkillFormula } from '@/lib/combat-engine/formulas'

export function computeDefenseFromFormula(
  formula: SkillFormula | null | undefined,
  attrs: Record<string, number>,
  rank: number
): number {
  if (!formula?.attrCoeffs) return 0
  let base = 0
  for (const [attr, coeff] of Object.entries(formula.attrCoeffs)) {
    base += (attrs[attr] ?? 0) * coeff
  }
  const rankTerm = (formula.skillRankCoeff ?? 0) * rank
  const flatBonus = formula.flatBonus ?? 0
  return Math.round(base + rankTerm + flatBonus)
}

export function computeDefenseForHero(hero: any) {
  const baseAttrs = { ...(hero.attrs as Record<string, number>) }
  const profile = (hero.combatProfiles ?? []).find((p: any) => p.dungeonLevel === null) ?? (hero.combatProfiles ?? [])[0]

  // buildHeroData may provide fully resolved equipment totals (overrides, runes and upgrades).
  // Other callers retain the legacy equipped item.stats behavior through the adapter.
  const equip = hero.equipStats && typeof hero.equipStats === 'object'
    ? hero.equipStats as Record<string, number>
    : calculateStats({
        entityId: asEntityId(String(hero.id ?? 'legacy-defense')),
        baseStats: {},
        modifiers: equippedItemsToModifiers((hero.items ?? []) as PersistedHeroItem[]),
      }).values

  const attrs = { ...baseAttrs }
  for (const key of ['st', 'co', 'in', 'dx', 'ch', 'ag', 'pe', 'wi']) {
    attrs[key] = (attrs[key] ?? 0) + (equip[key] ?? 0)
  }

  const result = calculateDefense({
    attributes: attrs,
    baseAttributes: baseAttrs,
    profile,
    skills: hero.skills ?? [],
  })
  const fortitudeBonus = (hero.skills ?? []).reduce((total: number, skill: any) => {
    const effect = skill.effect ?? skill.skill?.effect
    return total + (effect === 'fortitude' ? 10 : 0)
  }, 0)
  const equipmentDefense = Number.isFinite(equip.def) ? equip.def : 0
  const flatBonus = fortitudeBonus + equipmentDefense
  const values = Object.fromEntries(
    Object.entries(result.values).map(([category, value]) => [category, value + flatBonus])
  )
  const breakdown = Object.fromEntries(
    Object.entries(result.breakdown).map(([category, lines]) => [
      category,
      flatBonus === 0 ? [...lines] : [...lines, `bono fijo de equipo/pasiva = +${flatBonus}`],
    ])
  )
  return { values, breakdown }
}


/** Resolves the same equipment resistance channels used by dungeon combat. */
export function computeResistancesForHero(hero: any): Record<string, number> {
  const equip = hero.equipStats && typeof hero.equipStats === 'object'
    ? hero.equipStats as Record<string, number>
    : calculateStats({
        entityId: asEntityId(String(hero.id ?? 'legacy-resistances')),
        baseStats: {},
        modifiers: equippedItemsToModifiers((hero.items ?? []) as PersistedHeroItem[]),
      }).values
  const resistances: Record<string, number> = {}
  const armor = Number.isFinite(equip.armor) ? equip.armor : 0
  if (armor !== 0) {
    for (const type of ['physical', 'piercing', 'bleed']) resistances[type] = armor
  }
  for (const type of ['fire', 'ice', 'lightning', 'poison', 'holy', 'dark', 'psychological', 'arcane']) {
    const value = equip[`${type}Resist`]
    if (typeof value === 'number' && Number.isFinite(value)) resistances[type] = value
  }
  return resistances
}
