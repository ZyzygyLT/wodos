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

  const group = await db.clanGroup.findUnique({
    where: { id },
    include: { groupMembers: true, _count: { select: { groupMembers: true } } },
  })
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })
  if (group.leaderId !== hero.id) return NextResponse.json({ error: "Solo el líder puede invitar" }, { status: 403 })
  if (group._count.groupMembers >= 10) return NextResponse.json({ error: "Grupo completo (máx 10)" }, { status: 400 })

  const { targetName } = await req.json()
  if (!targetName) return NextResponse.json({ error: "Nombre del héroe a invitar requerido" }, { status: 400 })

  const target = await db.hero.findFirst({ where: { name: { equals: targetName, mode: "insensitive" } } })
  if (!target) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (target.id === hero.id) return NextResponse.json({ error: "No podés invitarte a vos mismo" }, { status: 400 })

  const alreadyMember = group.groupMembers.some(m => m.heroId === target.id)
  if (alreadyMember) return NextResponse.json({ error: "Ya está en el grupo" }, { status: 400 })

  const existingInvite = await db.groupInvite.findUnique({
    where: { groupId_heroId: { groupId: id, heroId: target.id } },
  })
  if (existingInvite?.status === "pending") return NextResponse.json({ error: "Ya tiene una invitación pendiente" }, { status: 400 })

  const invite = await db.groupInvite.upsert({
    where: { groupId_heroId: { groupId: id, heroId: target.id } },
    update: { status: "pending" },
    create: { groupId: id, heroId: target.id, status: "pending" },
  })

  await db.notification.create({
    data: {
      heroId: target.id,
      type: "group_invite",
      title: `Invitación a grupo`,
      body: `Fuiste invitado al grupo "${group.name}"`,
      data: { groupId: id, inviteId: invite.id },
    },
  })

  return NextResponse.json(invite, { status: 201 })
}
