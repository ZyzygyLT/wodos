import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { clanMember: true },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (!hero.clanMember) return NextResponse.json({ error: "No pertenecés a un clan" }, { status: 400 })

  const group = await db.clanGroup.findUnique({ where: { id: groupId } })
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })
  if (group.clanId !== hero.clanMember.clanId) return NextResponse.json({ error: "No es tu clan" }, { status: 403 })
  if (group.leaderId !== hero.id) return NextResponse.json({ error: "Solo el líder del grupo puede expulsar" }, { status: 403 })

  const { heroId } = await req.json()
  if (!heroId) return NextResponse.json({ error: "Falta heroId" }, { status: 400 })
  if (heroId === hero.id) return NextResponse.json({ error: "No podés expulsarte a vos mismo" }, { status: 400 })

  const member = await db.clanMember.findUnique({ where: { heroId } })
  if (member?.groupId !== group.id) return NextResponse.json({ error: "No está en este grupo" }, { status: 404 })

  await db.clanMember.update({
    where: { heroId },
    data: { groupId: null, groupRole: null },
  })

  return NextResponse.json({ success: true, kicked: heroId })
}
