import { evaluateFormula, SkillFormula } from '@/lib/combat-engine/formulas'

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
  const equip: Record<string, number> = (hero.items ?? [])
    .filter((hi: any) => hi.equipped)
    .reduce((acc: Record<string, number>, hi: any) => {
      const stats = hi.item.stats as Record<string, number> ?? {}
      for (const [k, v] of Object.entries(stats)) {
        if (k === 'healHp' || k === 'healMp') continue
        acc[k] = (acc[k] ?? 0) + v
      }
      return acc
    }, {})

  const attrs = { ...(hero.attrs as Record<string, number>) }
  for (const k of ['st', 'co', 'in', 'dx', 'ch', 'ag', 'pe', 'wi']) {
    attrs[k] = (attrs[k] ?? 0) + (equip[k] ?? 0)
  }

  const baseAttrs = { ...(hero.attrs as Record<string, number>) }
  const profile = (hero.combatProfiles ?? []).find((p: any) => p.dungeonLevel === null) ?? (hero.combatProfiles ?? [])[0]
  const ds = (profile?.defenseSkills ?? {}) as Record<string, number | null>
  const values: Record<string, number> = {}
  const breakdown: Record<string, string[]> = {}

  for (const cat of ['melee', 'ranged', 'magic']) {
    const result = computeDefenseCategory(cat, ds, hero, attrs, baseAttrs)
    values[cat] = result.value
    breakdown[cat] = result.lines
  }

  return { values, breakdown }
}

function computeDefenseCategory(cat: string, ds: Record<string, number | null>, hero: any, attrs: Record<string, number>, baseAttrs: Record<string, number>) {
  const skillId = ds[cat]
  const heroSkill = skillId
    ? (hero.skills ?? []).find((hs: any) => hs.skillId === skillId || hs.skill?.id === skillId)
    : null
  const formula = heroSkill?.skill?.formula ?? heroSkill?.formula
  const lines: string[] = []

  if (heroSkill && formula) {
    for (const [a, c] of Object.entries(formula.attrCoeffs ?? {})) {
      const v = attrs[a] ?? 0
      const baseV = baseAttrs[a] ?? 0
      const eqV = v - baseV
      lines.push(`${a}=${baseV}${eqV > 0 ? '+' + eqV + '(eq)' : ''} × ${c} = ${Math.round(v * (c as number))}`)
    }
    const rankTerm = (formula.skillRankCoeff ?? 0) * (heroSkill.rank ?? 1)
    if (rankTerm > 0) lines.push(`rango × ${formula.skillRankCoeff} = ${rankTerm}`)
    const flat = formula.flatBonus ?? 0
    if (flat > 0) lines.push(`base +${flat}`)

    const r = evaluateFormula(formula, attrs, heroSkill.rank ?? 1)
    return { value: Math.max(1, r.base + r.diceTotal), lines }
  }

  const fallback = (attrs.dx ?? 5) * 2
  lines.push(`dx=${attrs.dx} × 2 = ${fallback}`)
  return { value: fallback, lines }
}
