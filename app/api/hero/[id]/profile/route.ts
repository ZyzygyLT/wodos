import { NextRequest, NextResponse } from "next/server"
import db from "@/lib/db"
import { buildHeroData } from "@/lib/dungeon-helpers"
import { calculateEffectiveResourceMaxima, calculateInitiativeBase } from "@/engine/core/stats/derived-stats"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const hero = await db.hero.findFirst({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      level: true,
      fame: true,
      eloRating: true,
      arenaWins: true,
      arenaLosses: true,
      gold: true,
      epTotal: true,
      loginStreak: true,
      freeAttrPoints: true,
      hpCurrent: true,
      hpMax: true,
      mpCurrent: true,
      mpMax: true,
      attrs: true,
      combatProfiles: { where: { dungeonLevel: null }, take: 1 },
      class: { select: { name: true, icon: true } },
      race: { select: { name: true, icon: true, flavor: true } },
      clanMember: { select: { role: true, clan: { select: { name: true, tag: true, icon: true } } } },
      items: {
        where: { equipped: true },
        include: { item: { select: { name: true, icon: true, rarity: true, category: true, stats: true } }, runesIn: true },
      },
      skills: {
        include: { skill: true },
        orderBy: { rank: "desc" },
      },
    },
  })

  if (!hero) {
    return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  }

  const profile = hero.combatProfiles?.find((p: any) => p.dungeonLevel === null) ?? hero.combatProfiles?.[0] ?? null
  const combatHero = await buildHeroData(hero, profile)
  const computedAttrs = { ...(hero.attrs as Record<string, number>) }
  for (const key of ['st', 'co', 'in', 'dx', 'ch', 'ag', 'pe', 'wi']) {
    computedAttrs[key] = (computedAttrs[key] ?? 0) + (combatHero.equipStats[key] ?? 0)
  }
  for (const skill of combatHero.skills) {
    if (skill.effect === 'accuracy_up') computedAttrs.dx = (computedAttrs.dx ?? 0) + 5
    else if (skill.effect === 'speed_up') computedAttrs.ag = (computedAttrs.ag ?? 0) + 5
  }
  const computedInitiativeBase = calculateInitiativeBase({
    ag: computedAttrs.ag ?? 0,
    pe: computedAttrs.pe ?? 0,
  })

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
    computedAttrs,
    computedInitiativeBase,
    computedHpMax: effectiveResources.hpMax,
    computedMpMax: effectiveResources.mpMax,
  })
}
