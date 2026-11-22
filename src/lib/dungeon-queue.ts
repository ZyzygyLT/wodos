import { Queue, Worker, Job } from 'bullmq'
import { Redis } from 'ioredis'
import db from '@/lib/db'
import { runDungeon, HeroData } from '@/lib/combat-engine/dungeon-runner'
import { buildHeroData, enrichDungeonLevels, loadGroupParticipants, hasHeroRunDungeonToday, hasGroupRunDungeonToday } from '@/lib/dungeon-helpers'
import { calcClanBonuses } from '@/lib/clan/upgrades'
import { persistRunResult, processPostRun } from '@/services/dungeon-execution.service'
import logger from '@/lib/logger'

let connection: Redis | null = null
let queue: Queue | null = null

try {
  const url = process.env.REDIS_URL
  if (url) {
    connection = new Redis(url, { maxRetriesPerRequest: null })
    queue = new Queue('dungeon-runs', { connection: connection as any })
  }
} catch {
  connection = null
  queue = null
}

export function isQueueAvailable() {
  return queue !== null && connection !== null
}

async function executeRun(runId: string, heroId: string, dungeonId: number) {
  const run = await db.dungeonRun.findUnique({
    where: { id: runId },
    include: { dungeon: true, participants: true }
  })
  if (run?.status !== 'running') return

  const dungeon = run.dungeon

  // Prefer the immutable party captured when the run was registered.
  let heroesData: HeroData[]
  let totalHeroes: number

  if (run.participants?.length) {
    heroesData = run.participants.map((participant: any) => participant.snapshot as unknown as HeroData)
    if (heroesData.some(participant => !participant.id || !participant.combatProfile)) {
      throw new Error('DUNGEON_RUN_PARTICIPANT_SNAPSHOT_INVALID')
    }
    totalHeroes = heroesData.length
  } else if (run.groupId) {
    // Legacy runs created before participant snapshots retain the previous loading behavior.
    const groupResult = await loadGroupParticipants(run.groupId)
    if (groupResult.heroesData.length === 0) return
    heroesData = groupResult.heroesData
    totalHeroes = heroesData.length
  } else {
    const hero = await db.hero.findFirst({
      where: { id: heroId },
      include: {
        skills: { include: { skill: true } },
        items: { include: { item: true } },
        combatProfiles: true
      }
    })
    if (!hero) return

    const profile = run.profileId
      ? hero.combatProfiles.find((candidate: any) => candidate.id === run.profileId) ?? hero.combatProfiles[0]
      : hero.combatProfiles[0]
    heroesData = [await buildHeroData(hero, profile)]
    totalHeroes = 1
  }

  const dungeonData = await enrichDungeonLevels(dungeon)

  // Clan bonuses
  let clanBonuses: Record<string, number> | undefined
  try {
    const cm = await db.clanMember.findUnique({
      where: { heroId: heroesData[0].id },
      include: { clan: { include: { upgrades: true } } },
    })
    if (cm) clanBonuses = calcClanBonuses(cm.clan.upgrades)
  } catch {}

  const isGroup = totalHeroes > 1
  const firstOfDay = isGroup
    ? !(await hasGroupRunDungeonToday(heroesData.map(h => h.id)))
    : !(await hasHeroRunDungeonToday(heroId))

  const result = await runDungeon(heroesData, dungeonData, { clanBonuses, groupBonus: isGroup, firstOfDay })

  await db.$transaction(async (tx) => {
    await persistRunResult(tx, { runId: run.id, result, heroesData, totalHeroes })
  })

  await processPostRun({ result, heroesData, totalHeroes, dungeon, runId: run.id })

  return result
}

export async function enqueueDungeonRun(runId: string, heroId: string, dungeonId: number) {
  if (!queue || !connection) {
    throw new Error('Redis queue unavailable')
  }
  await queue.add('run-dungeon', { runId, heroId, dungeonId })
}

export function startWorker() {
  if (!connection || !queue) {
    logger.info('dungeon-queue', 'Redis no disponible — cola de dungeons deshabilitada')
    return
  }

  const worker = new Worker('dungeon-runs', async (job: Job) => {
    await executeRun(job.data.runId, job.data.heroId, job.data.dungeonId)
  }, { connection: connection as any })

  worker.on('completed', (job) => {
    logger.info('dungeon-queue', `Dungeon run ${job.id} completado`)
  })

  worker.on('failed', (job, err) => {
    logger.error('dungeon-queue', `Dungeon run ${job?.id} falló`, err)
  })

  logger.info('dungeon-queue', 'Worker de dungeons iniciado')
}
