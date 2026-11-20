import db from '@/lib/db'
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

  for (const fs of result.heroesFinalState) {
    const hData = heroesData.find(h => h.id === fs.id)
    if (!hData) continue
    await tx.hero.update({
      where: { id: fs.id },
      data: {
        epTotal: { increment: result.epGained / totalHeroes },
        gold: { increment: result.goldGained / totalHeroes },
        fame: { increment: result.fameGained },
        hpCurrent: hData.hpMax,
        mpCurrent: hData.mpMax,
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

  for (const fs of result.heroesFinalState) {
    await processPostRunForHero(fs.id, { result, heroesData, totalHeroes, dungeon, runId, clanMemberRec, kills })
  }

  await trackAnalytics(result, heroesData, dungeon, totalHeroes, runId)
}

interface PostRunHeroContext {
  result: RunResult
  heroesData: HeroData[]
  totalHeroes: number
  dungeon: { id: number; name: string; slug: string }
  runId: string
  clanMemberRec?: { clanId: string; clan: { upgrades: { upgradeId: string; tier: number }[] } } | null
  kills: number
}

async function processPostRunForHero(heroId: string, ctx: PostRunHeroContext) {
  const { result, heroesData, totalHeroes, dungeon, runId, clanMemberRec, kills } = ctx
  await checkLevelUp(heroId).catch(e => logger.error('dungeon-service', 'Error en level up', e))
  await grantMaterialDrops(heroId, dungeon.id, runId).catch(e => logger.error('dungeon-service', 'Error en material drops', e))
  await contributeToEvent(heroId, dungeon, clanMemberRec, kills)
  await updateQuestProgressForHero(heroId, dungeon, kills, result, totalHeroes)
  checkAchievements(heroId, { type: 'dungeon_complete' }).catch(e => logger.error('dungeon-service', 'Error en achievements', e))
  await trackEventProgressForHero(heroId, result)
  await adjustFactionRepForHero(heroId, result)
  await sendNotificationForHero(heroId, result, dungeon, runId, totalHeroes)
}

async function contributeToEvent(heroId: string, dungeon: { id: number; name: string; slug: string }, clanMemberRec: any, kills: number) {
  try {
    const activeEvent = await db.weeklyEvent.findFirst({
      where: { isActive: true, startsAt: { lte: new Date() }, endsAt: { gte: new Date() } },
    })
    if (!activeEvent || !clanMemberRec || kills <= 0) return
    await fetch(`${process.env.AUTH_URL}/api/events/${activeEvent.id}/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clanId: clanMemberRec.clanId, kills }),
    })
  } catch (e) {
    logger.error('dungeon-service', 'Error en evento', e)
  }
}

async function updateQuestProgressForHero(heroId: string, dungeon: { id: number; name: string; slug: string }, kills: number, result: RunResult, totalHeroes: number) {
  try {
    await updateQuestProgress(heroId, { type: 'dungeon_complete', dungeonSlug: dungeon.slug, kills }).catch(e => logger.error("dungeon-execution", "Background operation failed", e))
    if (kills > 0) {
      await updateQuestProgress(heroId, { type: 'total_kills', kills }).catch(e => logger.error("dungeon-execution", "Background operation failed", e))
    }
    await updateQuestProgress(heroId, { type: 'ep_total', value: result.epGained / totalHeroes }).catch(e => logger.error("dungeon-execution", "Background operation failed", e))
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

async function adjustFactionRepForHero(heroId: string, result: RunResult) {
  try {
    const repGain = result.victory ? 5 : 1
    await adjustRep(heroId, 1, repGain)
    if (result.victory) await adjustRep(heroId, 5, 2)
  } catch (e) {
    logger.error('dungeon-service', 'Error en faction rep', e)
  }
}

async function sendNotificationForHero(heroId: string, result: RunResult, dungeon: { id: number; name: string; slug: string }, runId: string, totalHeroes: number) {
  try {
    const lootCount = (result.loot ?? []).length
    await notify({
      heroId,
      type: result.victory ? 'dungeon_victory' : 'dungeon_defeat',
      title: result.victory ? `🏆 ${heroId.substring(0, 8)} venció ${dungeon.name}` : `⚔️ Derrota en ${dungeon.name}`,
      body: result.victory
        ? `${lootCount} items · +${result.epGained / totalHeroes} EP · +${result.goldGained / totalHeroes}💰`
        : `El grupo cayó en nivel ${result.levelsCleared + 1}. +${result.epGained / totalHeroes} EP igual.`,
      data: { runId, dungeonId: dungeon.id },
    })
  } catch (e) {
    logger.error('dungeon-service', 'Error en notificación in-app', e)
  }
}

async function trackAnalytics(result: RunResult, heroesData: HeroData[], dungeon: { id: number; name: string; slug: string }, totalHeroes: number, runId: string) {
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
