import db from '@/lib/db'
import { runDungeon, HeroData } from '@/lib/combat-engine/dungeon-runner'
import { buildHeroData, enrichDungeonLevels, loadGroupParticipants, hasHeroRunDungeonToday, hasGroupRunDungeonToday } from '@/lib/dungeon-helpers'
import { calcClanBonuses } from '@/lib/clan/upgrades'
import { persistRunResult, processPostRun } from '@/services/dungeon-execution.service'
import { tickTournament } from '@/lib/arena/tournament-cron'
import logger from '@/lib/logger'

function getNextScheduledTime(times: string[]): Date | null {
  if (!times || times.length === 0) return null
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  const candidates: Date[] = []
  for (const t of times) {
    const dt = new Date(`${todayStr}T${t}:00Z`)
    if (dt <= now) {
      dt.setDate(dt.getDate() + 1)
    }
    candidates.push(dt)
  }
  candidates.sort((a, b) => a.getTime() - b.getTime())
  return candidates[0] ?? null
}

function hasPassed(scheduledTimes: string[], since: Date, timerReductionHours = 0): boolean {
  const now = new Date()
  // Aplicar reducción del Altar del Tiempo
  const effectiveSince = new Date(since.getTime() + timerReductionHours * 3600000)
  const todayStr = now.toISOString().slice(0, 10)

  for (const t of scheduledTimes) {
    const dt = new Date(`${todayStr}T${t}:00Z`)
    if (dt > effectiveSince && dt <= now) return true
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)
  for (const t of scheduledTimes) {
    const dt = new Date(`${yesterdayStr}T${t}:00Z`)
    if (dt > effectiveSince && dt <= now) return true
  }

  return false
}

export async function tick() {
  try {
    const pending = await db.dungeonRun.findMany({
      where: { status: 'registered' },
      include: { dungeon: true },
    })

    for (const run of pending) {
      await processScheduledRun(run)
    }
  } catch (err) {
    logger.error('dungeon-cron', 'Error en tick', err)
  }
}

async function processScheduledRun(run: any) {
  const times = run.dungeon.scheduledTimes as string[]
  if (!times || times.length === 0) return

  const dungeon = run.dungeon

  const participants = await loadRunParticipants(run)
  if (!participants) return

  const { heroesData, allHeroIds } = participants
  const totalHeroes = heroesData.length
  const isGroup = totalHeroes > 1

  const clanInfo = await loadClanInfo(allHeroIds[0])
  const clanBonuses = clanInfo?.bonuses ?? {}
  const clanMemberRec = clanInfo?.memberRec ?? null

  const timerReduction = clanBonuses.timer_reduction_hours ?? 0
  if (!hasPassed(times, run.registeredAt, timerReduction)) return

  // Scheduled runs must enforce the same downed-hero rule as instant runs.
  // Do this before claiming the run so invalid registrations remain unexecuted.
  if (heroesData.some(hero => hero.hpCurrent !== undefined && hero.hpCurrent <= 0)) {
    await db.$transaction(async tx => {
      await tx.dungeonRun.updateMany({
        where: { id: run.id, status: 'registered' },
        data: { status: 'failed', result: 'defeat', executedAt: new Date(), completesAt: new Date() },
      })
      await tx.hero.updateMany({
        where: { id: run.heroId, dungeonRegisteredId: run.id },
        data: { dungeonRegisteredId: null },
      })
    })
    return
  }

  const claim = await db.dungeonRun.updateMany({
    where: { id: run.id, status: 'registered' },
    data: { status: 'running' },
  })
  if (claim.count !== 1) return

  try {
    const dungeonData = await enrichDungeonLevels(dungeon)

    const firstOfDay = isGroup
      ? !(await hasGroupRunDungeonToday(allHeroIds))
      : !(await hasHeroRunDungeonToday(run.heroId))

    const result = await runDungeon(heroesData, dungeonData, { clanBonuses, groupBonus: isGroup, firstOfDay })

    await db.$transaction(async (tx) => {
      await persistRunResult(tx, { runId: run.id, result, heroesData, totalHeroes })
    })

    await processPostRun({ result, heroesData, totalHeroes, dungeon, runId: run.id, clanMemberRec })
  } catch (err) {
    // If simulation or persistence fails, release only this still-running claim.
    // A completed run is never reset, so committed rewards cannot be replayed.
    logger.error('dungeon-cron', `Falló la ejecución programada ${run.id}`, err)
    await db.dungeonRun.updateMany({
      where: { id: run.id, status: 'running' },
      data: { status: 'registered' },
    }).catch(releaseError => logger.error('dungeon-cron', 'No se pudo liberar la ejecución fallida', releaseError))
  }
}

async function loadRunParticipants(run: any) {
  if (run.groupId) {
    const groupResult = await loadGroupParticipants(run.groupId)
    if (groupResult.heroesData.length === 0) return null
    return { heroesData: groupResult.heroesData, allHeroIds: groupResult.heroIds }
  }

  const hero = await db.hero.findFirst({
    where: { id: run.heroId },
    include: {
      combatProfiles: true,
      skills: { include: { skill: true } },
      items: { include: { item: true } },
    },
  })
  if (!hero) return null

  const profile = run.profileId
    ? hero.combatProfiles.find((p: any) => p.id === run.profileId)
    : hero.combatProfiles[0]
  const heroesData = [await buildHeroData(hero, profile)]
  return { heroesData, allHeroIds: [hero.id] }
}

async function loadClanInfo(heroId: string) {
  try {
    const cm = await db.clanMember.findUnique({
      where: { heroId },
      include: { clan: { include: { upgrades: true } } },
    })
    if (!cm) return null
    return {
      bonuses: calcClanBonuses(cm.clan.upgrades),
      memberRec: { clanId: cm.clanId, clan: cm.clan },
    }
  } catch {
    return null
  }
}

export async function resetDailyQuests() {
  try {
    const now = new Date()
    const repeatableQuests = await db.quest.findMany({
      where: { isRepeatable: true, resetHours: { not: null } },
    })

    for (const quest of repeatableQuests) {
      const cutoff = new Date(now.getTime() - (quest.resetHours ?? 24) * 3600000)
      const completed = await db.heroQuest.findMany({
        where: { questId: quest.id, status: "completed", completedAt: { lt: cutoff } },
      })

      for (const hq of completed) {
        const initialProgress: Record<string, number> = {}
        const objs = quest.objectives as any[]
        for (const obj of objs) initialProgress[obj.id] = 0

        await db.heroQuest.update({
          where: { id: hq.id },
          data: { status: "active", progress: initialProgress, completedAt: null },
        })
      }
    }

    return { reset: repeatableQuests.length }
  } catch (e) {
    logger.error('dungeon-cron', 'Error en resetDailyQuests', e)
    return { reset: 0, error: String(e) }
  }
}

let interval: ReturnType<typeof setInterval> | null = null

export function startDungeonCron() {
  if (interval) return
  logger.info('dungeon-cron', 'Iniciado — revisa cada 30s')
  tick()
  tickTournament().catch(e => logger.error('dungeon-cron', 'Error en tournament tick', e))
  interval = setInterval(() => {
    tick()
    tickTournament().catch(e => logger.error('dungeon-cron', 'Error en tournament tick', e))
  }, 30_000)
}

export function stopDungeonCron() {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}
