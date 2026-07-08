import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

const MAX_GROUPS = 3
const MAX_GROUP_SIZE = 10

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { clanMember: { include: { clan: { include: { groups: { include: { members: { include: { hero: { include: { class: true } } } } } } } } } } },
  })
  if (!hero?.clanMember) return NextResponse.json({ error: "Sin clan" }, { status: 400 })

  return NextResponse.json(hero.clanMember.clan.groups)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { clanMember: true },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (!hero.clanMember) return NextResponse.json({ error: "No pertenecés a un clan" }, { status: 400 })

  const { name } = await req.json()
  if (!name || name.length < 2) return NextResponse.json({ error: "Nombre del grupo (min 2 caracteres)" }, { status: 400 })

  const clanId = hero.clanMember.clanId
  const groupCount = await db.clanGroup.count({ where: { clanId } })
  if (groupCount >= MAX_GROUPS) return NextResponse.json({ error: `Máximo ${MAX_GROUPS} grupos por clan` }, { status: 400 })

  const group = await db.$transaction(async (tx) => {
    const g = await tx.clanGroup.create({
      data: { name, clanId, leaderId: hero.id },
    })
    await tx.clanMember.update({
      where: { heroId: hero.id },
      data: { groupId: g.id, groupRole: "leader" },
    })
    return tx.clanGroup.findUnique({
      where: { id: g.id },
      include: { members: { include: { hero: true } } },
    })
  })

  return NextResponse.json(group, { status: 201 })
}
