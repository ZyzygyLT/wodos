import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const run = await db.dungeonRun.findUnique({
    where: { id },
    include: { dungeon: true }
  })

  if (!run) {
    return NextResponse.json({ error: "Run no encontrado" }, { status: 404 })
  }

  // Autorización: el héroe debe ser el creador del run o miembro del grupo
  let authorized = run.heroId === hero.id
  let participants: { heroId: string; name: string }[] = []

  if (!authorized && run.groupId) {
    const group = await db.clanGroup.findUnique({
      where: { id: run.groupId },
      include: {
        members: {
          include: { hero: { select: { id: true, name: true } } },
        },
        groupMembers: {
          include: { hero: { select: { id: true, name: true } } },
        },
      },
    })
    if (group) {
      const allMembers = [
        ...group.members.map(m => ({ heroId: m.hero.id, name: m.hero.name })),
        ...group.groupMembers.map(m => ({ heroId: m.hero.id, name: m.hero.name })),
      ]
      authorized = allMembers.some(m => m.heroId === hero.id)
      participants = allMembers
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const isGroup = participants.length > 0 || run.groupId != null

  let respParticipants: { heroId: string; name: string }[]
  if (participants.length > 0) {
    respParticipants = participants
  } else if (run.heroId) {
    respParticipants = [{ heroId: run.heroId, name: hero.name }]
  } else {
    respParticipants = []
  }

  const report = run.report as any[] | null
  const rawLoot = (run.loot ?? []) as Array<{ itemId: number; qty: number; heroId?: string; heroName?: string }>
  let lootItems: Array<{ itemId: number; qty: number; name: string; heroId?: string; heroName?: string }> = []
  if (rawLoot.length > 0) {
    const ids = [...new Set(rawLoot.map(l => l.itemId))]
    const items = await db.item.findMany({ where: { id: { in: ids } } })
    const nameMap = new Map(items.map(i => [i.id, i.name]))
    lootItems = rawLoot.map(l => ({ ...l, name: nameMap.get(l.itemId) ?? `Item #${l.itemId}` }))
  }

  return NextResponse.json({
    id: run.id,
    dungeonName: run.dungeon.name,
    status: run.status,
    result: run.result,
    completesAt: run.completesAt,
    levelsCleared: run.levelsCleared,
    epGained: run.epGained,
    goldGained: run.goldGained,
    loot: lootItems,
    recentLog: report ? report.slice(-20) : null,
    fullReport: report,
    levelReports: run.levelReports as any,
    groupRun: isGroup,
    totalHeroes: respParticipants.length > 0 ? respParticipants.length : 1,
    participants: respParticipants,
  })
}
