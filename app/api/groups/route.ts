import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import logger from "@/lib/logger"

const MAX_GROUPS = 5
const MAX_GROUP_SIZE = 10

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) return fallbackGroups()
    const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
    if (!hero) return fallbackGroups()
    const groups = await loadUserGroups(hero.id)
    return NextResponse.json(groups)
  } catch (e) {
    logger.error('groups', "Error in GET /api/groups:", e)
    return fallbackGroups()
  }
}

async function loadUserGroups(heroId: string) {
  const groups: any[] = []

  const memberships = await db.groupMember.findMany({
    where: { heroId },
    include: {
      group: {
        include: {
          groupMembers: { include: { hero: { include: { class: true } } } },
          _count: { select: { groupMembers: true } },
        },
      },
    },
  })
  groups.push(...memberships.map(m => m.group))

  const testClan = await db.clan.findFirst({
    where: { name: 'Clan de Prueba' },
    select: {
      groups: {
        include: {
          members: { include: { hero: { include: { class: true } } } },
          _count: { select: { members: true } },
        },
      },
    },
  })
  if (testClan) {
    const existingIds = new Set(groups.map(g => g.id))
    for (const g of testClan.groups) {
      if (!existingIds.has(g.id)) {
        groups.push(g)
        existingIds.add(g.id)
      }
    }
  }

  return groups
}

async function fallbackGroups() {
  const testClan = await db.clan.findFirst({
    where: { name: 'Clan de Prueba' },
    select: {
      groups: {
        include: {
          members: { include: { hero: { include: { class: true } } } },
          _count: { select: { members: true } },
        },
      },
    },
  })
  return NextResponse.json(testClan?.groups ?? [])
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { name } = await req.json()
  if (!name || name.length < 2) return NextResponse.json({ error: "Nombre del grupo (min 2 caracteres)" }, { status: 400 })

  const groupCount = await db.clanGroup.count({ where: { clanId: null } })
  if (groupCount >= MAX_GROUPS) return NextResponse.json({ error: `Máximo ${MAX_GROUPS} grupos independientes` }, { status: 400 })

  const existing = await db.clanGroup.findFirst({ where: { name, clanId: null } })
  if (existing) return NextResponse.json({ error: "Ya existe un grupo con ese nombre" }, { status: 400 })

  const group = await db.$transaction(async (tx) => {
    const g = await tx.clanGroup.create({
      data: { name, clanId: null, leaderId: hero.id },
    })
    await tx.groupMember.create({
      data: { groupId: g.id, heroId: hero.id, role: "leader" },
    })
    return tx.clanGroup.findUnique({
      where: { id: g.id },
      include: { groupMembers: { include: { hero: { include: { class: true } } } } },
    })
  })

  return NextResponse.json(group, { status: 201 })
}
