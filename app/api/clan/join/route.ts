import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { notify } from "@/lib/notifications/emitter"
import { getMaxMembers } from "@/lib/clan/leveling"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, { include: { clanMember: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (hero.clanMember) return NextResponse.json({ error: "Ya pertenecés a un clan" }, { status: 400 })

  const { clanId } = await req.json()
  if (!clanId) return NextResponse.json({ error: "Falta clanId" }, { status: 400 })

  const clan = await db.clan.findUnique({
    where: { id: clanId },
    include: { _count: { select: { members: true } } },
  })
  if (!clan) return NextResponse.json({ error: "Clan no encontrado" }, { status: 404 })

  const maxMembers = getMaxMembers(clan.level)
  if (clan._count.members >= maxMembers) {
    return NextResponse.json({ error: `El clan está lleno (max ${maxMembers})` }, { status: 400 })
  }

  const member = await db.clanMember.create({
    data: { heroId: hero.id, clanId, role: "member" },
  })

  const clanMembers = await db.clanMember.findMany({
    where: { clanId, role: { in: ["leader", "officer"] } },
    select: { heroId: true },
  })
  for (const cm of clanMembers) {
    notify({
      heroId: cm.heroId,
      type: "clan_join",
      title: "👋 Nuevo miembro",
      body: `${hero.name} se unió al clan. Asignale un grupo desde la pestaña Grupos.`,
    }).catch(e => logger.error("api", "Background operation failed", e))
  }

  return NextResponse.json(member, { status: 201 })
}
