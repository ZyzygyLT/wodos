import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const group = await db.clanGroup.findUnique({ where: { id } })
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })
  if (group.leaderId !== hero.id) return NextResponse.json({ error: "Solo el líder puede expulsar" }, { status: 403 })

  const { heroId: targetId } = await req.json()
  if (!targetId) return NextResponse.json({ error: "heroId requerido" }, { status: 400 })
  if (targetId === hero.id) return NextResponse.json({ error: "No podés expulsarte a vos mismo" }, { status: 400 })

  const member = await db.groupMember.findUnique({
    where: { groupId_heroId: { groupId: id, heroId: targetId } },
  })
  if (!member) return NextResponse.json({ error: "Ese héroe no está en el grupo" }, { status: 400 })

  await db.groupMember.delete({ where: { id: member.id } })
  return NextResponse.json({ success: true })
}
