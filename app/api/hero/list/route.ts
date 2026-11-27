import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const activeHero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
  const heroes = await db.hero.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      level: true,
      class: { select: { name: true, icon: true } },
    },
  })

  return NextResponse.json({
    currentHeroId: activeHero?.id ?? null,
    heroes,
  })
}
