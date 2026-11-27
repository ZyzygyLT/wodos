import db from '@/lib/db'
import { splitIntegerReward } from '@/lib/reward-distribution'
import type { RunResult, HeroData } from '@/lib/combat-engine/dungeon-runner'
import { applyLevelUpInTransaction, publishLevelUpEffects, type LevelUpResult } from '@/lib/level-up'
import { grantMaterialDrops } from '@/lib/craft/material-drops'
import { updateQuestProgress } from '@/lib/quests/progress'
import { checkAchievements } from '@/lib/achievements/checker'
import { notify } from '@/lib/notifications/emitter'
import { trackDungeonCompleted } from "@/lib/analytics/events"
import logger from "@/lib/logger"
import { trackHeroEventProgress } from '@/services/event.service'
import { adjustRep } from '@/services/faction.service'

interface PersistParams {
  runId: string
  result: RunResult
  heroesData: HeroData[]
  totalHeroes: number
  dungeon?: { id: number; name: string; slug: string }
  clanMemberRec?: { clanId: string; clan: { upgrades: { upgradeId: string; tier: number }[] } } | null
}

export async function persistRunResult(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], params: PersistParams) {
  const { runId, result, heroesData } = params

  const finalized = await tx.dungeonRun.updateMany({
    where: { id: runId, status: 'running' },
    data: {
      status: result.victory ? 'done' : 'failed',
      result: result.victory ? 'victory' : 'defeat',
      report: result.log as unknown as any,
      levelReports: result.levelReports as unknown as any,
      levelsCleared: result.levelsCleared,
      epGained: result.epGained,
      goldGained: result.goldGained,
      fameGained: result.fameGained,
      loot: result.loot,
      executedAt: new Date(),
      completesAt: new Date(),
    },
  })
  if (finalized.count !== 1) {
    throw new Error('DUNGEON_RUN_ALREADY_FINALIZED')
  }

  const consumedByHero = new Map<string, string[]>()
  for (const consumedItem of result.consumedConsumables ?? []) {
    const ids = consumedByHero.get(consumedItem.heroId) ?? []
    ids.push(consumedItem.heroItemId)
    consumedByHero.set(consumedItem.heroId, ids)
  }
  for (const [heroId, consumedIds] of consumedByHero) {
    const consumed = await tx.heroItem.deleteMany({
      where: { id: { in: consumedIds }, heroId },
    })
    if (consumed.count !== consumedIds.length) throw new Error('DUNGEON_CONSUMABLE_INVENTORY_MISMATCH')
  }

  const fameShares = splitIntegerReward(result.fameGained, result.heroesFinalState.length)
  const epShares = splitIntegerReward(result.epGained, result.heroesFinalState.length)
  const goldShares = splitIntegerReward(result.goldGained, result.heroesFinalState.length)
  const levelUps: Array<{ heroId: string; result: LevelUpResult }> = []
  for (const [index, fs] of result.heroesFinalState.entries()) {
    const hData = heroesData.find(h => h.id === fs.id)
    if (!hData) continue
    await tx.hero.update({
      where: { id: fs.id },
      data: {
        epTotal: { increment: epShares[index] },
        gold: { increment: goldShares[index] },
        fame: { increment: fameShares[index] },
        hpCurrent: fs.hp,
        mpCurrent: fs.mp,
        dungeonRegisteredId: null,
      },
    })
    const levelUp = await applyLevelUpInTransaction(tx, fs.id)
    levelUps.push({ heroId: fs.id, result: levelUp })
  }

  if (result.loot && result.loot.length > 0) {
    await persistLootToHeroes(tx, result)
  }

  if (params.dungeon) {
    await tx.dungeonRunPostProcessing.create({
      data: {
        runId,
        payload: {
          result,
          heroIds: result.heroesFinalState.map(hero => hero.id),
          totalHeroes: params.totalHeroes,
          dungeon: params.dungeon,
          clanMemberRec: params.clanMemberRec ?? null,
          levelUps,
        } as any,
      },
    })
  }

  return { levelUps }
}

async function persistLootToHeroes(tx: any, result: RunResult) {
  const lootByHero = new Map<string, Array<{ itemId: number; qty: number }>>()
  for (const l of result.loot) {
    const hId = (l as any).heroId ?? result.heroesFinalState[0]?.id
    if (!hId) continue
    if (!lootByHero.has(hId)) lootByHero.set(hId, [])
    lootByHero.get(hId)!.push({ itemId: l.itemId, qty: l.qty })
  }
  for (const [hId, items] of lootByHero) {
    await tx.heroItem.createMany({
      data: items.flatMap(l =>
        Array.from({ length: l.qty }, () => ({
          heroId: hId,
          itemId: l.itemId,
          equipped: false,
        }))
      ),
    })
  }
}

interface PostRunParams {
  result: RunResult
  heroesData: HeroData[]
  totalHeroes: number
  dungeon: { id: number; name: string; slug: string }
  runId: string
  levelUps: Array<{ heroId: string; result: LevelUpResult }>
  clanMemberRec?: { clanId: string; clan: { upgrades: { upgradeId: string; tier: number }[] } } | null
}

interface PersistedPostRunPayload {
  result: RunResult
  heroIds: string[]
  totalHeroes: number
  dungeon: { id: number; name: string; slug: string }
  clanMemberRec: PostRunParams["clanMemberRec"]
  levelUps: Array<{ heroId: string; result: LevelUpResult }>
}

const POST_RUN_STALE_AFTER_MS = 10 * 60 * 1000
const POST_RUN_MAX_RETRY_DELAY_MS = 5 * 60 * 1000

/**
 * Claims and executes the durable post-settlement task. The conditional update
 * prevents cron and queue workers from processing the same run concurrently.
 */
export async function processDungeonRunPostProcessing(runId: string): Promise<boolean> {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - POST_RUN_STALE_AFTER_MS)
  const claimed = await db.dungeonRunPostProcessing.updateMany({
    where: {
      runId,
      OR: [
        { status: { in: ["pending", "failed"] }, nextAttemptAt: { lte: now } },
        { status: "processing", startedAt: { lt: staleBefore } },
      ],
    },
    data: {
      status: "processing",
      attempts: { increment: 1 },
      startedAt: now,
      lastError: null,
    },
  })
  if (claimed.count !== 1) return false

  const task = await db.dungeonRunPostProcessing.findUnique({ where: { runId } })
  if (!task) return false

  try {
    const payload = task.payload as unknown as PersistedPostRunPayload
    await processPostRun({
      result: payload.result,
      heroesData: payload.heroIds.map(id => ({ id } as HeroData)),
      totalHeroes: payload.totalHeroes,
      dungeon: payload.dungeon,
      runId,
      clanMemberRec: payload.clanMemberRec,
      levelUps: payload.levelUps,
    })
    await db.dungeonRunPostProcessing.updateMany({
      where: { runId, status: "processing" },
      data: { status: "completed", completedAt: new Date(), startedAt: null, lastError: null },
    })
    return true
  } catch (error) {
    const attempts = Number(task.attempts ?? 1)
    const delay = Math.min(POST_RUN_MAX_RETRY_DELAY_MS, 5_000 * Math.pow(2, Math.max(0, attempts - 1)))
    await db.dungeonRunPostProcessing.updateMany({
      where: { runId, status: "processing" },
      data: {
        status: "failed",
        startedAt: null,
        lastError: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
        nextAttemptAt: new Date(Date.now() + delay),
      },
    })
    throw error
  }
}

/** Retry pending, failed, and abandoned post-run tasks from the dungeon cron. */
export async function processPendingDungeonRunPostProcessing(limit = 20) {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - POST_RUN_STALE_AFTER_MS)
  const tasks = await db.dungeonRunPostProcessing.findMany({
    where: {
      OR: [
        { status: { in: ["pending", "failed"] }, nextAttemptAt: { lte: now } },
        { status: "processing", startedAt: { lt: staleBefore } },
      ],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { runId: true },
  })

  let completed = 0
  for (const task of tasks) {
    try {
      if (await processDungeonRunPostProcessing(task.runId)) completed++
    } catch (error) {
      logger.error("dungeon-post-processing", `No se pudo completar el post-procesamiento de ${task.runId}`, error)
    }
  }
  return { attempted: tasks.length, completed }
}

export async function processPostRun(params: PostRunParams) {
  const { result, heroesData, dungeon, runId, clanMemberRec, levelUps } = params

  const kills = (result.log as any[])?.filter(
    (l: any) => l.type === 'death' && !l.actorId?.startsWith('hero')
  ).length ?? 0

  const epShares = splitIntegerReward(result.epGained, result.heroesFinalState.length)
  const goldShares = splitIntegerReward(result.goldGained, result.heroesFinalState.length)
  for (const [index, fs] of result.heroesFinalState.entries()) {
    await processPostRunForHero(fs.id, {
      result, dungeon, runId, kills,
      epShare: epShares[index],
      goldShare: goldShares[index],
      levelUp: levelUps.find(entry => entry.heroId === fs.id)?.result,
    })
  }

  // Clan event contribution belongs to the expedition, not to each participant.
  // Apply it once so group size cannot multiply the same kill count.
  await contributeToEvent(clanMemberRec, kills, runId, result.heroesFinalState[0]?.id)

  await trackAnalytics(result, heroesData, dungeon, runId)
}

interface PostRunHeroContext {
  result: RunResult
  dungeon: { id: number; name: string; slug: string }
  runId: string
  kills: number
  epShare: number
  goldShare: number
  levelUp?: LevelUpResult
}

async function processPostRunForHero(heroId: string, ctx: PostRunHeroContext) {
  const { result, dungeon, runId, kills, epShare, goldShare, levelUp } = ctx
  if (levelUp) publishLevelUpEffects(heroId, levelUp)
  await grantMaterialDrops(heroId, dungeon.id, runId)
  await updateQuestProgressForHero(heroId, dungeon, kills, epShare, runId)
  await checkAchievements(heroId, { type: 'dungeon_complete' })
  await trackEventProgressForHero(heroId, result, runId)
  await adjustFactionRepForHero(heroId, result, runId)
  await sendNotificationForHero(heroId, result, dungeon, runId, epShare, goldShare)
}

type ClanMemberRecord = NonNullable<PostRunParams['clanMemberRec']>

async function contributeToEvent(
  clanMemberRec: ClanMemberRecord | null | undefined,
  kills: number,
  runId: string,
  leaderHeroId?: string,
) {
  if (!clanMemberRec || kills <= 0 || !leaderHeroId) return
  const activeEvent = await db.weeklyEvent.findFirst({
    where: { isActive: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
    select: { id: true },
  })
  if (!activeEvent) return

  const score = Math.max(0, Math.min(Math.floor(kills), 1000))
  try {
    await db.$transaction(async tx => {
      await tx.dungeonRunRewardGrant.create({
        data: { runId, heroId: leaderHeroId, kind: `clan_event:${activeEvent.id}` },
      })
      await tx.clanEventParticipation.upsert({
        where: { clanId_eventId: { clanId: clanMemberRec.clanId, eventId: activeEvent.id } },
        update: { score: { increment: score } },
        create: { clanId: clanMemberRec.clanId, eventId: activeEvent.id, score },
      })
    })
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return
    throw error
  }
}

async function updateQuestProgressForHero(heroId: string, dungeon: { id: number; name: string; slug: string }, kills: number, epShare: number, runId: string) {
  await updateQuestProgress(heroId, { type: 'dungeon_complete', dungeonSlug: dungeon.slug, kills, sourceRunId: runId })
  if (kills > 0) {
    await updateQuestProgress(heroId, { type: 'total_kills', kills, sourceRunId: runId })
  }
  await updateQuestProgress(heroId, { type: 'ep_total', value: epShare, sourceRunId: runId })
}

async function trackEventProgressForHero(heroId: string, result: RunResult, runId: string) {
  await trackHeroEventProgress(heroId, 'invasion', 1, runId)
  await trackHeroEventProgress(heroId, 'dungeon', 1, runId)
  if (result.victory) await trackHeroEventProgress(heroId, 'boss', 1, runId)
}

async function adjustFactionRepForHero(heroId: string, result: RunResult, runId: string) {
  const repGain = result.victory ? 5 : 1
  const source = { sourceType: "dungeon_run", sourceId: runId }
  await adjustRep(heroId, 1, repGain, undefined, source)
  if (result.victory) await adjustRep(heroId, 5, 2, undefined, source)
}

async function sendNotificationForHero(heroId: string, result: RunResult, dungeon: { id: number; name: string; slug: string }, runId: string, epShare: number, goldShare: number) {
  const lootCount = (result.loot ?? []).length
  await notify({
    heroId,
    type: result.victory ? 'dungeon_victory' : 'dungeon_defeat',
    title: result.victory ? `🏆 ${heroId.substring(0, 8)} venció ${dungeon.name}` : `⚔️ Derrota en ${dungeon.name}`,
    body: result.victory
      ? `${lootCount} items · +${epShare} EP · +${goldShare}💰`
      : `El grupo cayó en nivel ${result.levelsCleared + 1}. +${epShare} EP igual.`,
    data: { runId, dungeonId: dungeon.id },
    dedupeKey: `dungeon_run:${runId}:${heroId}`,
  })
}

async function trackAnalytics(result: RunResult, heroesData: HeroData[], dungeon: { id: number; name: string; slug: string }, runId: string) {
  try {
    const firstHero = heroesData[0]
    trackDungeonCompleted(firstHero.id, {
      dungeonName: dungeon.name,
      victory: result.victory,
      epGained: result.epGained,
      goldGained: result.goldGained,
      lootCount: (result.loot as any[])?.length ?? 0,
    })
  } catch (e) {
    logger.error('dungeon-service', 'Error en analytics', e)
  }
}
