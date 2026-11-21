import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { trackClanCreated } from "@/lib/analytics/events"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, {
    include: {
      clanMember: {
        include: {
          clan: {
            include: {
              members: { include: { hero: { include: { class: true } } } },
              upgrades: true,
              groups: { include: { members: { include: { hero: { include: { class: true } } } } } },
            },
          },
        },
      },
    },
  })

  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (!hero.clanMember) return NextResponse.json(null)

  return NextResponse.json(hero.clanMember.clan)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, { include: { clanMember: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (hero.clanMember) return NextResponse.json({ error: "Ya perteneces a un clan" }, { status: 400 })

  const { name, tag, icon, description } = await req.json()
  if (!name || !tag || tag.length > 4) {
    return NextResponse.json({ error: "Nombre y tag requeridos (tag max 4 chars)" }, { status: 400 })
  }

  const clan = await db.$transaction(async (tx) => {
    const c = await tx.clan.create({
      data: {
        name,
        tag: tag.toUpperCase(),
        icon: icon || "⚔️",
        description,
        groups: {
          create: { name: `${name} - Grupo 1`, leaderId: hero.id },
        },
        members: {
          create: { heroId: hero.id, role: "leader" },
        },
      },
      include: { members: true },
    })
    // Asignar el groupId al member record
    const group = await tx.clanGroup.findFirst({ where: { clanId: c.id } })
    if (group) {
      await tx.clanMember.update({
        where: { heroId: hero.id },
        data: { groupId: group.id, groupRole: "leader" },
      })
    }
    return c
  })

  trackClanCreated(session.user.id, { clanName: clan.name })

  return NextResponse.json(clan, { status: 201 })
}
