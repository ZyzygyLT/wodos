import { NextRequest, NextResponse } from "next/server"
import db from "@/lib/db"

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
      class: { select: { name: true, icon: true } },
      race: { select: { name: true, icon: true, flavor: true } },
      clanMember: { select: { role: true, clan: { select: { name: true, tag: true, icon: true } } } },
      items: {
        where: { equipped: true },
        include: { item: { select: { name: true, icon: true, rarity: true, category: true, stats: true } } },
      },
      skills: {
        include: { skill: { select: { name: true, icon: true, type: true, tier: true } } },
        orderBy: { rank: "desc" },
      },
    },
  })

  if (!hero) {
    return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  }

  return NextResponse.json(hero)
}
