import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const clanMember = await db.clanMember.findUnique({ where: { heroId: hero.id } })
  if (!clanMember) {
    return NextResponse.json({ error: "No pertenecés a ningún clan" }, { status: 403 })
  }

  const { clanId, kills } = await req.json()
  if (!clanId || !kills || typeof kills !== 'number') {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 })
  }

  const cappedKills = Math.max(0, Math.min(Math.floor(kills), 1000))

  if (clanMember.clanId !== clanId) {
    return NextResponse.json({ error: "No pertenecés a ese clan" }, { status: 403 })
  }

  const { id } = await params

  await db.clanEventParticipation.upsert({
    where: { clanId_eventId: { clanId, eventId: id } },
    update: { score: { increment: cappedKills } },
    create: { clanId, eventId: id, score: cappedKills },
  })

  return NextResponse.json({ success: true })
}
