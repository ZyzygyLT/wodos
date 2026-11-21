import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

const MAX_GROUP_SIZE = 10

export async function POST(req: NextRequest, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id, { include: { clanMember: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (!hero.clanMember) return NextResponse.json({ error: "No pertenecés a un clan" }, { status: 400 })

  const group = await db.clanGroup.findUnique({
    where: { id: groupId },
    include: { members: true },
  })
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })
  if (group.clanId !== hero.clanMember.clanId) return NextResponse.json({ error: "No es tu clan" }, { status: 403 })

  const alreadyMember = group.members.some(m => m.heroId === hero.id)
  if (alreadyMember) return NextResponse.json({ error: "Ya estás en este grupo" }, { status: 400 })

  if (group.members.length >= MAX_GROUP_SIZE) return NextResponse.json({ error: `Máximo ${MAX_GROUP_SIZE} miembros por grupo` }, { status: 400 })

  const existingGroup = await db.clanMember.findUnique({
    where: { heroId: hero.id },
    select: { groupId: true },
  })
  if (existingGroup?.groupId) return NextResponse.json({ error: "Ya estás en otro grupo. Salí primero." }, { status: 400 })

  // Verificar invitación pendiente
  const invite = await db.groupInvite.findUnique({
    where: { groupId_heroId: { groupId, heroId: hero.id } },
  })
  if (invite?.status !== "pending") {
    return NextResponse.json({ error: "No tenés una invitación pendiente para este grupo" }, { status: 403 })
  }

  await db.$transaction([
    db.clanMember.update({
      where: { heroId: hero.id },
      data: { groupId: group.id, groupRole: "member" },
    }),
    db.groupInvite.update({
      where: { id: invite.id },
      data: { status: "accepted" },
    }),
  ])

  return NextResponse.json({ success: true, groupName: group.name })
}
