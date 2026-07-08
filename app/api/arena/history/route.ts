import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const duels = await db.duelHistory.findMany({
    where: {
      OR: [{ hero1Id: hero.id }, { hero2Id: hero.id }],
    },
    orderBy: { foughtAt: "desc" },
    take: 50,
    include: {
      hero1: { select: { id: true, name: true, level: true, class: { select: { icon: true } } } },
      hero2: { select: { id: true, name: true, level: true, class: { select: { icon: true } } } },
      winner: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json({ duels })
}
