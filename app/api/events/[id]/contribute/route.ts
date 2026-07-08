import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { clanId, kills } = await req.json()
  if (!clanId || !kills) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 })
  }

  const { id } = await params

  await db.clanEventParticipation.upsert({
    where: { clanId_eventId: { clanId, eventId: id } },
    update: { score: { increment: kills } },
    create: { clanId, eventId: id, score: kills },
  })

  return NextResponse.json({ success: true })
}
