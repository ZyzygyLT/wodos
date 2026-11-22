import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const ownedHeroes = await db.hero.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true },
  })
  if (ownedHeroes.length === 0) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }
  const ownedHeroIds = new Set(ownedHeroes.map(hero => hero.id))

  const run = await db.dungeonRun.findUnique({
    where: { id },
    include: {
      dungeon: true,
      participants: { select: { heroId: true, snapshot: true } },
    },
  })

  if (!run) {
    return NextResponse.json({ error: "Run no encontrado" }, { status: 404 })
  }

  // Prefer immutable participants captured at registration. Current group membership
  // must never grant access to a historical report.
  const historicalParticipants = run.participants.map(participant => {
    const snapshot = participant.snapshot as { name?: string }
    return { heroId: participant.heroId, name: snapshot?.name ?? 'Héroe' }
  })

  let respParticipants = historicalParticipants
  let authorized =
    (run.heroId != null && ownedHeroIds.has(run.heroId)) ||
    historicalParticipants.some(participant => ownedHeroIds.has(participant.heroId))

  // Legacy runs predate participant snapshots; retain their old group-based access path.
  if (run.participants.length === 0 && !authorized && run.groupId) {
    const group = await db.clanGroup.findUnique({
      where: { id: run.groupId },
      include: {
        members: { include: { hero: { select: { id: true, name: true } } } },
        groupMembers: { include: { hero: { select: { id: true, name: true } } } },
      },
    })
    if (group) {
      respParticipants = [
        ...group.members.map(member => ({ heroId: member.hero.id, name: member.hero.name })),
        ...group.groupMembers.map(member => ({ heroId: member.hero.id, name: member.hero.name })),
      ]
      authorized = respParticipants.some(participant => ownedHeroIds.has(participant.heroId))
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const isGroup = respParticipants.length > 1 || run.groupId != null
  if (respParticipants.length === 0 && ownedHeroes.some(owned => owned.id === run.heroId)) {
    const owner = ownedHeroes.find(owned => owned.id === run.heroId)!
    respParticipants = [{ heroId: owner.id, name: owner.name }]
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
