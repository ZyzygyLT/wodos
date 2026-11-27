import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const runs = await db.dungeonRun.findMany({
    where: {
      OR: [
        { heroId: hero.id },
        { participants: { some: { heroId: hero.id } } },
      ],
      // Only terminal runs belong in history. A running expedition has no
      // settled result yet and must not be presented as a defeat.
      status: { in: ['done', 'failed'] },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { dungeon: { select: { name: true, icon: true } } },
  })

  return NextResponse.json(
    runs.map(r => ({
      id: r.id,
      dungeonName: r.dungeon.name,
      dungeonIcon: r.dungeon.icon,
      status: r.status,
      result: r.result,
      levelsCleared: r.levelsCleared,
      epGained: r.epGained,
      goldGained: r.goldGained,
      fameGained: r.fameGained,
      createdAt: r.createdAt,
    }))
  )
}
