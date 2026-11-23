import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, { include: { heroQuests: { include: { quest: true } } } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const activeQuests = hero.heroQuests.filter(hq => hq.status === "active")
  const allQuests = await db.quest.findMany({ where: { levelReq: { lte: hero.level } } })
  const activeIds = new Set(hero.heroQuests.map(hq => hq.questId))
  const completedSlugs = new Set(
    hero.heroQuests.filter(hq => hq.status === "completed").map(hq => hq.quest.slug)
  )

  const available = allQuests.filter(q => {
    if (activeIds.has(q.id)) return false
    if (!q.isRepeatable && completedSlugs.has(q.slug)) return false
    return true
  })

  return NextResponse.json({ active: activeQuests, available })
}
