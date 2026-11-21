import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const publicCategories = await db.forumCategory.findMany({
    where: { clanId: null },
    orderBy: { order: "asc" },
    include: { _count: { select: { topics: true } } },
  })

  const member = await db.clanMember.findUnique({
    where: { heroId: hero.id },
    include: { clan: { include: { forumCategories: { include: { _count: { select: { topics: true } } } } } } },
  })
  const clanCategory = member?.clan?.forumCategories?.[0] ?? null

  return NextResponse.json({ public: publicCategories, clanCategory })
}
