import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { computeDefenseForHero } from "@/lib/combat-engine/hero-stats"
import { buildHeroData } from "@/lib/dungeon-helpers"
import { calculateEffectiveResourceMaxima } from "@/engine/core/stats/derived-stats"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { maxHeroes: true, _count: { select: { heroes: true } } } })
  const hero = await getActiveHeroByUserId(session.user.id, {
    include: {
      class: true,
      race: true,
      combatProfiles: { orderBy: { createdAt: 'asc' } },
      skills: { include: { skill: true } },
      items: { include: { item: true } },
    },
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe. Creá uno primero." }, { status: 404 })
  }

  // Match the combat loadout pipeline: equipped item stats, overrides, runes and upgrades.
  const profile = hero.combatProfiles?.find((p: any) => p.dungeonLevel === null)
    ?? hero.combatProfiles?.[0]
    ?? null
  const combatHero = await buildHeroData(hero, profile)
  const defData = computeDefenseForHero({ ...hero, equipStats: combatHero.equipStats })
  const effectiveResources = calculateEffectiveResourceMaxima({
    baseHpMax: hero.hpMax,
    baseMpMax: hero.mpMax,
    level: hero.level,
    baseAttributes: hero.attrs as Record<string, number>,
    effectiveAttributes: Object.fromEntries(
      Object.entries(hero.attrs as Record<string, number>).map(([key, value]) => [key, value + (combatHero.equipStats[key] ?? 0)])
    ),
    equipmentHp: combatHero.equipStats.hp,
    equipmentMp: combatHero.equipStats.mp,
    skillEffects: combatHero.skills.map(skill => skill.effect),
  })

  return NextResponse.json({
    ...hero,
    computedDefense: defData.values,
    computedHpMax: effectiveResources.hpMax,
    computedMpMax: effectiveResources.mpMax,
    defenseBreakdown: defData.breakdown,
    heroCount: user?._count?.heroes ?? 1,
    maxHeroes: user?.maxHeroes ?? 3,
  })
}
