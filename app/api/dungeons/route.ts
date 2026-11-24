import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { calcClanBonuses } from "@/lib/clan/upgrades"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, {
    include: { combatProfiles: { orderBy: [{ dungeonLevel: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }] } },
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const clanMember = await db.clanMember.findUnique({
    where: { heroId: hero.id },
    include: { clan: { include: { upgrades: true } } },
  })
  const clanBonuses = clanMember ? calcClanBonuses(clanMember.clan.upgrades) : {}
  const hasLootPreview = (clanBonuses.loot_preview ?? 0) > 0
  const hasBossReveal = (clanBonuses.boss_reveal ?? 0) > 0

  const dungeons = await db.dungeon.findMany({
    where: {
      OR: [
        { levelReq: { lte: hero.level }, clanId: null },
        ...(clanMember ? [{ clanId: clanMember.clanId }] : []),
      ],
    },
    orderBy: { difficulty: "asc" },
  })

  const itemMap = hasLootPreview ? await buildItemMap(dungeons) : {}

  // Participants have no hero.dungeonRegisteredId of their own. Resolve the
  // active run through the participant relation so the map reflects the same
  // reservation that registration enforces. Keep the legacy pointer fallback.
  const activeParticipantRun = await db.dungeonRun.findFirst({
    where: {
      participants: { some: { heroId: hero.id } },
      status: { in: ["registered", "running"] },
    },
    orderBy: { createdAt: "desc" },
    include: { dungeon: { select: { name: true } } },
  })
  const registeredRun = activeParticipantRun ?? (hero.dungeonRegisteredId
    ? await db.dungeonRun.findUnique({
        where: { id: hero.dungeonRegisteredId },
        include: { dungeon: { select: { name: true } } },
      })
    : null)
  const activeRun = registeredRun && ["registered", "running"].includes(registeredRun.status)
    ? registeredRun
    : null

  const generalProfiles = hero.combatProfiles.filter(profile => profile.dungeonLevel === null)
  const selectableProfiles = generalProfiles.length > 0 ? generalProfiles : hero.combatProfiles.slice(0, 1)

  const result = dungeons.map(d => {
    const times = (d.scheduledTimes ?? []) as string[]
    const nextScheduledTime = getNextScheduledTime(times)
    const isRegistered = activeRun?.dungeonId === d.id

    const entry: Record<string, unknown> = {
      id: d.id, name: d.name, slug: d.slug, icon: d.icon,
      description: d.description, lore: d.lore,
      levelReq: d.levelReq, recommendedLevel: d.recommendedLevel,
      difficultyLabel: d.difficultyLabel, difficulty: d.difficulty,
      isInstant: d.isInstant,
      epReward: d.epReward, goldReward: d.goldReward, fameReward: d.fameReward,
      scheduledTimes: times,
      isRegistered,
      registeredRunId: isRegistered ? activeRun!.id : null,
      activeRunDungeonId: activeRun?.dungeonId ?? null,
      activeRunDungeonName: activeRun?.dungeon.name ?? null,
      nextScheduledTime: nextScheduledTime?.toISOString() ?? null,
      profiles: selectableProfiles.map(p => ({
        id: p.id, name: p.name, position: p.position,
      })),
    }

    if (hasLootPreview) {
      const rawTable = (d.lootTable ?? []) as { itemId: number; chance: number; minQty: number; maxQty: number }[]
      entry.lootTable = rawTable.map(l => ({
        ...l,
        name: itemMap[l.itemId] ?? `Item #${l.itemId}`,
      }))
    }
    if (hasBossReveal) {
      entry.levels = d.levels
    }

    return entry
  })

  return NextResponse.json(result)
}

async function buildItemMap(dungeons: any[]) {
  const allItemIds = new Set<number>()
  for (const d of dungeons) {
    const table = (d.lootTable ?? []) as { itemId: number }[]
    for (const entry of table) allItemIds.add(entry.itemId)
  }
  if (allItemIds.size === 0) return {}
  const items = await db.item.findMany({
    where: { id: { in: [...allItemIds] } },
    select: { id: true, name: true, icon: true },
  })
  const itemMap: Record<number, string> = {}
  for (const it of items) {
    itemMap[it.id] = `${it.icon} ${it.name}`
  }
  return itemMap
}

function getNextScheduledTime(times: string[]): Date | null {
  if (!times || times.length === 0) return null
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  for (const t of times) {
    const dt = new Date(`${todayStr}T${t}:00Z`)
    if (dt > now) return dt
  }

  const sorted = [...times].sort((a, b) => a.localeCompare(b))
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)
  return new Date(`${tomorrowStr}T${sorted[0]}:00Z`)
}
