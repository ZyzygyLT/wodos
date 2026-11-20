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

  return calculateDefense({
    attributes: attrs,
    baseAttributes: baseAttrs,
    profile,
    skills: hero.skills ?? [],
  })
}
