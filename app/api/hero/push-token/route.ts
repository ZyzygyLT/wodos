import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const { token } = await req.json()
  if (!token) {
    return NextResponse.json({ error: "Falta token" }, { status: 400 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { currentHeroId: true } })
  let heroId = user?.currentHeroId
  if (!heroId) {
    const fallback = await db.hero.findFirst({ where: { userId: session.user.id }, orderBy: { createdAt: 'asc' }, select: { id: true } })
    if (!fallback) return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
    heroId = fallback.id
  }

  await db.hero.update({ where: { id: heroId }, data: { pushToken: token } })

  return NextResponse.json({ success: true })
}
