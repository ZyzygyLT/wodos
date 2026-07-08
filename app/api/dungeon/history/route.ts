import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const runs = await db.dungeonRun.findMany({
    where: { heroId: hero.id, status: { not: 'registered' } },
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
      createdAt: r.createdAt,
    }))
  )
}
