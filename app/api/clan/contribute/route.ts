import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { clanMember: true },
  })
  if (!hero?.clanMember) {
    return NextResponse.json({ error: "No perteneces a un clan" }, { status: 400 })
  }

  const { amount } = await req.json()
  if (!Number.isInteger(amount) || amount < 1) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 })
  }
  if (hero.gold < amount) {
    return NextResponse.json({ error: "Oro insuficiente" }, { status: 400 })
  }

  await db.$transaction([
    db.hero.update({ where: { id: hero.id }, data: { gold: { decrement: amount } } }),
    db.clan.update({ where: { id: hero.clanMember.clanId }, data: { gold: { increment: amount } } }),
    db.clanMember.update({
      where: { heroId: hero.id },
      data: { goldContributed: { increment: amount } },
    }),
  ])

  return NextResponse.json({ success: true, contributed: amount })
}
