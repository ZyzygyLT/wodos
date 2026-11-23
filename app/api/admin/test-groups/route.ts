import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } })
  if (!user?.isAdmin) return NextResponse.json({ error: "No autorizado" }, { status: 403 })

  // 1. Independent groups (clanId: null, GroupMember-based)
  const independentGroups = await db.clanGroup.findMany({
    where: { clanId: null },
    include: {
      groupMembers: {
        include: { hero: { include: { class: true, race: true } } }
      }
    },
    orderBy: { createdAt: "asc" }
  })

  // 2. Test clan groups (ClanMember-based)
  const testClan = await db.clan.findFirst({
    where: { name: 'Clan de Prueba' },
    select: {
      groups: {
        include: {
          members: { include: { hero: { include: { class: true, race: true } } } }
        }
      }
    }
  })

  const result = [
    ...independentGroups.map(g => ({
      id: g.id, name: g.name, icon: g.icon, leaderId: g.leaderId,
      members: g.groupMembers.map(m => ({
        heroId: m.hero.id, name: m.hero.name,
        className: m.hero.class.name, classSlug: m.hero.class.slug,
        raceName: m.hero.race.name, level: m.hero.level, role: m.role,
      }))
    })),
    ...(testClan?.groups ?? []).map(g => ({
      id: g.id, name: g.name, icon: g.icon, leaderId: g.leaderId,
      members: g.members.map(m => ({
        heroId: m.hero.id, name: m.hero.name,
        className: m.hero.class.name, classSlug: m.hero.class.slug,
        raceName: m.hero.race.name, level: m.hero.level,
        role: m.groupRole ?? 'member',
      }))
    }))
  ]

  return NextResponse.json(result)
}
