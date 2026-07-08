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

  const invite = await db.groupInvite.findUnique({ where: { id } })
  if (!invite) return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 })
  if (invite.heroId !== hero.id) return NextResponse.json({ error: "No es tu invitación" }, { status: 403 })
  if (invite.status !== "pending") return NextResponse.json({ error: "Invitación ya procesada" }, { status: 400 })

  const group = await db.clanGroup.findUnique({
    where: { id: invite.groupId },
    include: { _count: { select: { groupMembers: true } } },
  })
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })
  if (group._count.groupMembers >= 10) return NextResponse.json({ error: "Grupo completo (máx 10)" }, { status: 400 })

  const alreadyMember = await db.groupMember.findUnique({
    where: { groupId_heroId: { groupId: invite.groupId, heroId: hero.id } },
  })
  if (alreadyMember) return NextResponse.json({ error: "Ya estás en el grupo" }, { status: 400 })

  await db.$transaction([
    db.groupMember.create({
      data: { groupId: invite.groupId, heroId: hero.id, role: "member" },
    }),
    db.groupInvite.update({
      where: { id },
      data: { status: "accepted" },
    }),
  ])

  return NextResponse.json({ success: true, groupName: group.name })
}
