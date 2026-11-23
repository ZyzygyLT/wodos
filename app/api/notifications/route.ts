import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const [unreadCount, notifications] = await Promise.all([
    db.notification.count({ where: { heroId: hero.id, readAt: null } }),
    db.notification.findMany({
      where: { heroId: hero.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ])

  return NextResponse.json({ notifications, unreadCount })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { ids, all } = await req.json()

  if (all) {
    await db.notification.updateMany({
      where: { heroId: hero.id, readAt: null },
      data: { readAt: new Date() },
    })
  } else if (Array.isArray(ids) && ids.length > 0) {
    await db.notification.updateMany({
      where: { id: { in: ids }, heroId: hero.id },
      data: { readAt: new Date() },
    })
  }

  return NextResponse.json({ success: true })
}
