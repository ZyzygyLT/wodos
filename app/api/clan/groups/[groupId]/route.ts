import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const group = await db.clanGroup.findUnique({
    where: { id: groupId },
    include: { members: { include: { hero: { include: { class: true } } } } },
  })
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })

  return NextResponse.json(group)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id, { include: { clanMember: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (!hero.clanMember) return NextResponse.json({ error: "Sin clan" }, { status: 400 })

  const group = await db.clanGroup.findUnique({ where: { id: groupId } })
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })
  if (group.clanId !== hero.clanMember.clanId) return NextResponse.json({ error: "No es tu clan" }, { status: 403 })
  if (group.leaderId !== hero.id) return NextResponse.json({ error: "Solo el líder del grupo puede eliminarlo" }, { status: 403 })

  await db.clanGroup.delete({ where: { id: groupId } })

  return NextResponse.json({ success: true })
}
