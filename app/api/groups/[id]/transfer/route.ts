import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const group = await db.clanGroup.findUnique({ where: { id } })
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })
  if (group.leaderId !== hero.id) return NextResponse.json({ error: "Solo el líder puede transferir" }, { status: 403 })

  const { heroId: targetId } = await req.json()
  if (!targetId) return NextResponse.json({ error: "heroId requerido" }, { status: 400 })
  if (targetId === hero.id) return NextResponse.json({ error: "Ya sos el líder" }, { status: 400 })

  const targetMember = await db.groupMember.findUnique({
    where: { groupId_heroId: { groupId: id, heroId: targetId } },
  })
  if (!targetMember) return NextResponse.json({ error: "Ese héroe no está en el grupo" }, { status: 400 })

  await db.$transaction([
    db.groupMember.update({
      where: { groupId_heroId: { groupId: id, heroId: targetId } },
      data: { role: "leader" },
    }),
    db.groupMember.update({
      where: { groupId_heroId: { groupId: id, heroId: hero.id } },
      data: { role: "member" },
    }),
    db.clanGroup.update({
      where: { id },
      data: { leaderId: targetId },
    }),
  ])

  return NextResponse.json({ success: true })
}
