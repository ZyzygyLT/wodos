import db from '@/lib/db'
import { splitIntegerReward } from '@/lib/reward-distribution'
import type { RunResult, HeroData } from '@/lib/combat-engine/dungeon-runner'
import { checkLevelUp } from '@/lib/level-up'
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
}

export async function persistRunResult(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], params: PersistParams) {
  const { runId, result, heroesData, totalHeroes } = params

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
  }

  if (result.loot && result.loot.length > 0) {
    await persistLootToHeroes(tx, result)
  }
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
  clanMemberRec?: { clanId: string; clan: { upgrades: { upgradeId: string; tier: number }[] } } | null
}

export async function processPostRun(params: PostRunParams) {
  const { result, heroesData, totalHeroes, dungeon, runId, clanMemberRec } = params

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
    })
  }

  // Clan event contribution belongs to the expedition, not to each participant.
  // Apply it once so group size cannot multiply the same kill count.
  await contributeToEvent(clanMemberRec, kills)

  await trackAnalytics(result, heroesData, dungeon, runId)
}

interface PostRunHeroContext {
  result: RunResult
  dungeon: { id: number; name: string; slug: string }
  runId: string
  kills: number
  epShare: number
  goldShare: number
}

async function processPostRunForHero(heroId: string, ctx: PostRunHeroContext) {
  const { result, dungeon, runId, kills, epShare, goldShare } = ctx
  await checkLevelUp(heroId).catch(e => logger.error('dungeon-service', 'Error en level up', e))
  await grantMaterialDrops(heroId, dungeon.id, runId).catch(e => logger.error('dungeon-service', 'Error en material drops', e))
  await updateQuestProgressForHero(heroId, dungeon, kills, epShare, runId)
  checkAchievements(heroId, { type: 'dungeon_complete' }).catch(e => logger.error('dungeon-service', 'Error en achievements', e))
  await trackEventProgressForHero(heroId, result)
  await adjustFactionRepForHero(heroId, result, runId)
  await sendNotificationForHero(heroId, result, dungeon, runId, epShare, goldShare)
}

type ClanMemberRecord = NonNullable<PostRunParams['clanMemberRec']>

async function contributeToEvent(clanMemberRec: ClanMemberRecord | null | undefined, kills: number) {
  try {
    if (!clanMemberRec || kills <= 0) return
    const activeEvent = await db.weeklyEvent.findFirst({
      where: { isActive: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
      select: { id: true },
    })
    if (!activeEvent) return

    const score = Math.max(0, Math.min(Math.floor(kills), 1000))
    await db.clanEventParticipation.upsert({
      where: { clanId_eventId: { clanId: clanMemberRec.clanId, eventId: activeEvent.id } },
      update: { score: { increment: score } },
      create: { clanId: clanMemberRec.clanId, eventId: activeEvent.id, score },
    })
  } catch (e) {
    logger.error('dungeon-service', 'Error en evento', e)
  }
}

async function updateQuestProgressForHero(heroId: string, dungeon: { id: number; name: string; slug: string }, kills: number, epShare: number, runId: string) {
  try {
    await updateQuestProgress(heroId, { type: 'dungeon_complete', dungeonSlug: dungeon.slug, kills, sourceRunId: runId }).catch(e => logger.error("dungeon-execution", "Background operation failed", e))
    if (kills > 0) {
      await updateQuestProgress(heroId, { type: 'total_kills', kills, sourceRunId: runId }).catch(e => logger.error("dungeon-execution", "Background operation failed", e))
    }
    await updateQuestProgress(heroId, { type: 'ep_total', value: epShare, sourceRunId: runId }).catch(e => logger.error("dungeon-execution", "Background operation failed", e))
  } catch (e) {
    logger.error('dungeon-service', 'Error en quest progress', e)
  }
}

async function trackEventProgressForHero(heroId: string, result: RunResult) {
  try {
    await trackHeroEventProgress(heroId, 'invasion', 1)
    await trackHeroEventProgress(heroId, 'dungeon', 1)
    if (result.victory) await trackHeroEventProgress(heroId, 'boss', 1)
  } catch (e) {
    logger.error('dungeon-service', 'Error en hero event progress', e)
  }
}

async function adjustFactionRepForHero(heroId: string, result: RunResult, runId: string) {
  try {
    const repGain = result.victory ? 5 : 1
    const source = { sourceType: "dungeon_run", sourceId: runId }
    await adjustRep(heroId, 1, repGain, undefined, source)
    if (result.victory) await adjustRep(heroId, 5, 2, undefined, source)
  } catch (e) {
    logger.error('dungeon-service', 'Error en faction rep', e)
  }
}

async function sendNotificationForHero(heroId: string, result: RunResult, dungeon: { id: number; name: string; slug: string }, runId: string, epShare: number, goldShare: number) {
  try {
    const lootCount = (result.loot ?? []).length
    await notify({
      heroId,
      type: result.victory ? 'dungeon_victory' : 'dungeon_defeat',
      title: result.victory ? `🏆 ${heroId.substring(0, 8)} venció ${dungeon.name}` : `⚔️ Derrota en ${dungeon.name}`,
      body: result.victory
        ? `${lootCount} items · +${epShare} EP · +${goldShare}💰`
        : `El grupo cayó en nivel ${result.levelsCleared + 1}. +${epShare} EP igual.`,
      data: { runId, dungeonId: dungeon.id },
    })
  } catch (e) {
    logger.error('dungeon-service', 'Error en notificación in-app', e)
  }
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
