import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { clanMember: true },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (!hero.clanMember) return NextResponse.json({ error: "No pertenecés a un clan" }, { status: 400 })
  if (hero.clanMember.role !== "leader") return NextResponse.json({ error: "Solo el líder puede transferir el clan" }, { status: 403 })

  const { heroId } = await req.json()
  if (!heroId) return NextResponse.json({ error: "Falta heroId" }, { status: 400 })
  if (heroId === hero.id) return NextResponse.json({ error: "Ya sos el líder" }, { status: 400 })

  const target = await db.clanMember.findUnique({ where: { heroId } })
  if (target?.clanId !== hero.clanMember.clanId) return NextResponse.json({ error: "No está en tu clan" }, { status: 404 })

  await db.$transaction([
    db.clanMember.update({ where: { heroId: hero.id }, data: { role: "member" } }),
    db.clanMember.update({ where: { heroId }, data: { role: "leader" } }),
  ])

  return NextResponse.json({ success: true, newLeader: heroId })
}
