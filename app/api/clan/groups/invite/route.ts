import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { auth } from "@/auth"
import db from "@/lib/db"
import { notify } from "@/lib/notifications/emitter"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { clanMember: { include: { clan: true } } },
  })
  if (!hero?.clanMember) return NextResponse.json({ error: "No pertenecés a un clan" }, { status: 400 })

  const { groupId, heroId } = await req.json()
  if (!groupId || !heroId) return NextResponse.json({ error: "Faltan groupId o heroId" }, { status: 400 })

  const group = await db.clanGroup.findUnique({
    where: { id: groupId },
    include: { clan: { include: { _count: { select: { members: true } } } } },
  })
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })
  if (group.clanId !== hero.clanMember.clanId) return NextResponse.json({ error: "No pertenecés a este clan" }, { status: 403 })
  if (group.leaderId !== hero.id) return NextResponse.json({ error: "Solo el líder del grupo puede invitar" }, { status: 403 })

  // Verificar que el invitado pertenece al clan
  const targetMember = await db.clanMember.findUnique({ where: { heroId } })
  if (targetMember?.clanId !== hero.clanMember.clanId) {
    return NextResponse.json({ error: "El héroe no pertenece a tu clan" }, { status: 400 })
  }
  if (targetMember.groupId) return NextResponse.json({ error: "El héroe ya tiene un grupo" }, { status: 400 })

  // Verificar límite de miembros del grupo (máx 10)
  const memberCount = await db.clanMember.count({ where: { groupId } })
  if (memberCount >= 10) return NextResponse.json({ error: "El grupo está lleno (máx 10)" }, { status: 400 })

  // Verificar si ya hay una invitación pendiente
  const existing = await db.groupInvite.findUnique({
    where: { groupId_heroId: { groupId, heroId } },
  })
  if (existing?.status === "pending") return NextResponse.json({ error: "Ya hay una invitación pendiente" }, { status: 400 })

  const invite = await db.groupInvite.upsert({
    where: { groupId_heroId: { groupId, heroId } },
    update: { status: "pending" },
    create: { groupId, heroId, status: "pending" },
  })

  notify({
    heroId,
    type: "group_invite",
    title: "👥 Invitación a grupo",
    body: `Te invitaron a unirte a "${group.name}"`,
  }).catch(e => logger.error("api", "Background operation failed", e))

  return NextResponse.json(invite, { status: 201 })
}
