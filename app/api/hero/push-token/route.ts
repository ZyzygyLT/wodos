import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const { token } = await req.json()
  if (!token) {
    return NextResponse.json({ error: "Falta token" }, { status: 400 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
  if (!hero) return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })

  await db.hero.update({ where: { id: hero.id }, data: { pushToken: token } })

  return NextResponse.json({ success: true })
}
