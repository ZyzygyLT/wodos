import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { heroQuests: { include: { quest: true } } },
  })
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
