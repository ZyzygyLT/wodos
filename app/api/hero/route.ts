import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getHeroByUserId } from "@/lib/hero-utils"
import { computeDefenseForHero } from "@/lib/combat-engine/hero-stats"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { currentHeroId: true } })
  let hero = null
  if (user?.currentHeroId) {
    hero = await db.hero.findUnique({ where: { id: user.currentHeroId }, include: { class: true, race: true, combatProfiles: { orderBy: { createdAt: 'asc' } }, skills: { include: { skill: true } }, items: { include: { item: true } } } })
  }
  hero ??= await getHeroByUserId(session.user.id)
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe. Creá uno primero." }, { status: 404 })
  }

  const defData = computeDefenseForHero(hero)
  return NextResponse.json({ ...hero, computedDefense: defData.values, defenseBreakdown: defData.breakdown })
}
