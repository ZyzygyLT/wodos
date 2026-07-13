import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!hero) return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })

  const history = await db.heroAdventure.findMany({
    where: { heroId: hero.id, status: { in: ['completed', 'failed', 'claimed'] } },
    include: {
      adventure: { select: { name: true, icon: true, description: true, levelReq: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 20,
  })

  return NextResponse.json({
    history: history.map(h => ({
      id: h.id,
      adventureName: h.adventure.name,
      adventureIcon: h.adventure.icon,
      adventureDescription: h.adventure.description,
      status: h.status,
      startedAt: h.startedAt,
      completedAt: h.completedAt,
      totalSteps: h.totalSteps,
      energySpent: h.energySpent,
    })),
  })
}
