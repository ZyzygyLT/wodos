import db from '@/lib/db'
import { runDungeon, HeroData, RunResult } from '@/lib/combat-engine/dungeon-runner'
import { buildHeroData, enrichDungeonLevels, loadGroupParticipants, hasHeroRunDungeonToday, hasGroupRunDungeonToday, snapshotDungeonParticipant } from '@/lib/dungeon-helpers'
import { checkLevelUp, LevelUpResult } from '@/lib/level-up'
import { persistRunResult, processPostRun } from '@/services/dungeon-execution.service'
import { calcClanBonuses } from "@/lib/clan/upgrades"
import logger from "@/lib/logger"

export interface InstantRunParams {
  heroId: string
  dungeonId: number
  profileId: string | null
  groupId: string | null
}

export interface InstantRunResult {
  runId: string
  isGroup: boolean
  totalHeroes: number
  victory: boolean
  rounds: number
  epGained: number
  goldGained: number
  fameGained: number
  heroFinalHp: number
  heroesFinalState: RunResult['heroesFinalState']
  loot: Array<{ itemId: number; qty: number; name: string }>
  log: string[]
  levelUp?: LevelUpResult
  firstOfDay?: boolean
}

export async function processInstantDungeon(params: InstantRunParams): Promise<{ ok: boolean; error?: string; status?: number; data?: InstantRunResult }> {
  const hero = await db.hero.findFirst({
    where: { id: params.heroId },
    include: {
      combatProfiles: { orderBy: { createdAt: 'asc' } },
      skills: { include: { skill: true } },
      items: { include: { item: true } },
    },
  })
  if (!hero) return { ok: false, error: 'No tenés un héroe', status: 404 }
  if (hero.hpCurrent <= 0) return { ok: false, error: 'Tu héroe está derribado. Esperá a que se recupere.', status: 400 }

  const dungeon = await db.dungeon.findUnique({ where: { id: params.dungeonId } })
  if (!dungeon) return { ok: false, error: 'Mazmorra no encontrada', status: 404 }
  if (dungeon.levelReq > hero.level) return { ok: false, error: 'Nivel insuficiente para esta mazmorra', status: 400 }

  const profileId = params.profileId ?? hero.combatProfiles[0]?.id ?? null
  const profile = profileId ? hero.combatProfiles.find(p => p.id === profileId) ?? hero.combatProfiles[0] ?? null : null

  const cm = await db.clanMember.findUnique({ where: { heroId: hero.id } })
  const effectiveGroupId = params.groupId ?? cm?.groupId

  const groupResult = await loadCombatGroup(effectiveGroupId, hero, profile, dungeon.levelReq)
  if (!groupResult.ok) return { ok: false, error: groupResult.error!, status: groupResult.status! }
  const { heroesData, totalHeroes, isGroup } = groupResult

  if (isGroup && !heroesData.some(h => h.combatProfile?.position === 'front')) {
    return { ok: false, error: 'El grupo necesita al menos un héroe en posición frontal', status: 400 }
  }

  const clanBonuses = cm ? await loadClanBonuses(hero.id) : undefined
  const dungeonData = await enrichDungeonLevels(dungeon)

  const runId = await createInstantRunReservation(hero.id, dungeon, profile, effectiveGroupId, heroesData)
  if (!runId) {
    return { ok: false, error: 'Uno de los héroes ya está comprometido en otra expedición', status: 409 }
  }

  // Evaluate the daily bonus after reservation so concurrent runs cannot both claim first-of-day.
  let firstOfDay = false
  let result: RunResult
  try {
    firstOfDay = isGroup
      ? !(await hasGroupRunDungeonToday(heroesData.map(h => h.id)))
      : !(await hasHeroRunDungeonToday(hero.id))
    result = await runDungeon(heroesData, dungeonData, { clanBonuses, groupBonus: isGroup, firstOfDay })
    await db.$transaction(async tx => {
      await persistRunResult(tx, { runId, result, heroesData, totalHeroes })
    })
  } catch (error) {
    logger.error('dungeon-registration', 'Instant dungeon execution failed', error)
    await db.dungeonRun.updateMany({
      where: { id: runId, status: 'running' },
      data: { status: 'failed', result: 'defeat', executedAt: new Date(), completesAt: new Date() },
    }).catch(updateError => logger.error('dungeon-registration', 'Could not finalize failed instant run', updateError))
    return { ok: false, error: 'No se pudo completar la expedición. Intentá nuevamente.', status: 500 }
  }

  const levelUp = await checkLevelUp(hero.id)
  await processPostRun({ result, heroesData, totalHeroes, dungeon, runId }).catch(error => {
    logger.error('dungeon-registration', 'Post-run processing failed', error)
  })
  const itemMap = await loadLootItemMap(result)

  return {
    ok: true,
    data: {
      runId,
      isGroup,
      totalHeroes,
      victory: result.victory,
      rounds: result.totalRounds,
      epGained: result.epGained,
      goldGained: result.goldGained,
      fameGained: result.fameGained,
      heroFinalHp: result.heroesFinalState[0]?.hp ?? 0,
      heroesFinalState: result.heroesFinalState,
      loot: (result.loot ?? []).map(l => ({ itemId: l.itemId, qty: l.qty, name: itemMap.get(l.itemId)?.name ?? `#${l.itemId}` })),
      log: result.log.slice(-5).map(l => l.message),
      levelUp: levelUp.leveledUp ? levelUp : undefined,
      firstOfDay,
    },
  }
}

export async function registerScheduledDungeon(params: InstantRunParams): Promise<{ ok: boolean; error?: string; status?: number; data?: { id: string; dungeon: string; status: string } }> {
  const hero = await db.hero.findFirst({
    where: { id: params.heroId },
    include: {
      combatProfiles: { orderBy: { createdAt: 'asc' } },
      skills: { include: { skill: true } },
      items: { include: { item: true } },
    },
  })
  if (!hero) return { ok: false, error: 'No tenés un héroe', status: 404 }
  if (hero.hpCurrent <= 0) return { ok: false, error: 'Tu héroe está derribado. Esperá a que se recupere.', status: 400 }

  const dungeon = await db.dungeon.findUnique({ where: { id: params.dungeonId } })
  if (!dungeon) return { ok: false, error: 'Mazmorra no encontrada', status: 404 }
  if (dungeon.levelReq > hero.level) return { ok: false, error: 'Nivel insuficiente para esta mazmorra', status: 400 }

  const profileId = params.profileId ?? hero.combatProfiles[0]?.id ?? null

  const cm = await db.clanMember.findUnique({ where: { heroId: hero.id } })
  const effectiveGroupId = params.groupId ?? cm?.groupId ?? null

  const groupResult = await loadCombatGroup(effectiveGroupId, hero, profileId ? hero.combatProfiles.find(p => p.id === profileId) ?? hero.combatProfiles[0] ?? null : null, dungeon.levelReq)
  if (!groupResult.ok) return { ok: false, error: groupResult.error!, status: groupResult.status! }
  if (groupResult.isGroup && !groupResult.heroesData.some(h => h.combatProfile?.position === 'front')) {
    return { ok: false, error: 'El grupo necesita al menos un héroe en posición frontal', status: 400 }
  }

  const participantIds = groupResult.heroesData.map(participant => participant.id)
  const run = await db.$transaction(async tx => {
    // Lock participants in a stable order so overlapping group registrations serialize safely.
    for (const participantId of [...participantIds].sort()) {
      await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${participantId} FOR UPDATE`
    }

    const otherParticipantIds = participantIds.filter(participantId => participantId !== hero.id)
    const prevRun = await tx.dungeonRun.findFirst({
      where: { heroId: hero.id, status: 'registered' },
    })

    const runningOwnRun = await tx.dungeonRun.findFirst({
      where: { heroId: hero.id, status: 'running' },
      select: { id: true },
    })
    if (runningOwnRun) return null

    const participatingInOtherRun = await tx.dungeonRunParticipant.findFirst({
      where: {
        heroId: hero.id,
        run: {
          is: {
            heroId: { not: hero.id },
            status: { in: ['registered', 'running'] },
          },
        },
      },
      select: { id: true },
    })
    if (participatingInOtherRun) return null

    if (otherParticipantIds.length > 0) {
      const occupiedParticipant = await tx.dungeonRunParticipant.findFirst({
        where: {
          heroId: { in: otherParticipantIds },
          run: {
            is: {
              status: { in: ['registered', 'running'] },
              ...(prevRun ? { id: { not: prevRun.id } } : {}),
            },
          },
        },
        select: { heroId: true },
      })
      if (occupiedParticipant) return null

      const legacyActiveRun = await tx.dungeonRun.findFirst({
        where: {
          heroId: { in: otherParticipantIds },
          status: { in: ['registered', 'running'] },
          ...(prevRun ? { id: { not: prevRun.id } } : {}),
        },
        select: { id: true },
      })
      if (legacyActiveRun) return null
    }

    if (prevRun) {
      await tx.dungeonRun.update({
        where: { id: prevRun.id },
        data: { status: 'failed', result: 'defeat' },
      })
    }

    const createdRun = await tx.dungeonRun.create({
      data: {
        heroId: hero.id,
        dungeonId: dungeon.id,
        profileId,
        groupId: effectiveGroupId,
        status: 'registered',
        participants: {
          create: groupResult.heroesData.map(participant => ({
            heroId: participant.id,
            profileId: participant.profileId ?? null,
            snapshot: JSON.parse(JSON.stringify(snapshotDungeonParticipant(participant))),
          })),
        },
      },
    })

    await tx.hero.update({
      where: { id: hero.id },
      data: { dungeonRegisteredId: createdRun.id },
    })
    return createdRun
  })

  if (!run) {
    return { ok: false, error: 'Uno de los héroes ya está comprometido en otra expedición', status: 409 }
  }

  return { ok: true, data: { id: run.id, dungeon: dungeon.name, status: 'registered' } }
}

interface CombatGroupResult {
  ok: boolean
  error?: string
  status?: number
  heroesData: HeroData[]
  totalHeroes: number
  isGroup: boolean
}

async function loadCombatGroup(effectiveGroupId: string | null | undefined, hero: any, profile: any, levelReq: number): Promise<CombatGroupResult> {
  if (effectiveGroupId) {
    const groupResult = await loadGroupParticipants(effectiveGroupId)
    if (groupResult.heroesData.length === 0) return { ok: false, error: 'Grupo vacío o no encontrado', status: 404, heroesData: [], totalHeroes: 0, isGroup: false }
    if (!groupResult.heroIds.includes(hero.id)) return { ok: false, error: 'Tu héroe no pertenece a este grupo', status: 403, heroesData: [], totalHeroes: 0, isGroup: false }
    for (const h of groupResult.heroesData) {
      if (h.hpCurrent !== undefined && h.hpCurrent <= 0) return { ok: false, error: `${h.name} está derribado y no puede participar`, status: 400, heroesData: [], totalHeroes: 0, isGroup: false }
      if (h.level < levelReq) return { ok: false, error: `${h.name} no tiene nivel suficiente (min ${levelReq})`, status: 400, heroesData: [], totalHeroes: 0, isGroup: false }
    }
    return { ok: true, heroesData: groupResult.heroesData, totalHeroes: groupResult.heroesData.length, isGroup: groupResult.heroesData.length > 1 }
  }
  const heroesData = [await buildHeroData(hero, profile)]
  return { ok: true, heroesData, totalHeroes: 1, isGroup: false }
}

async function loadClanBonuses(heroId: string) {
  const full = await db.clanMember.findUnique({
    where: { heroId },
    include: { clan: { include: { upgrades: true } } },
  })
  return full ? calcClanBonuses(full.clan.upgrades) : undefined
}

async function loadLootItemMap(result: any) {
  const lootItemIds = [...new Set((result.loot ?? []).map((l: any) => l.itemId))] as number[]
  if (lootItemIds.length === 0) return new Map()
  const lootItems = await db.item.findMany({ where: { id: { in: lootItemIds } } })
  return new Map(lootItems.map((i: any) => [i.id, i]))
}

async function createInstantRunReservation(
  heroId: string,
  dungeon: any,
  profile: any,
  groupId: string | null | undefined,
  heroesData: HeroData[],
): Promise<string | null> {
  return db.$transaction(async tx => {
    const participantIds = heroesData.map(participant => participant.id)
    for (const participantId of [...participantIds].sort()) {
      await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${participantId} FOR UPDATE`
    }

    const activeParticipant = await tx.dungeonRunParticipant.findFirst({
      where: {
        heroId: { in: participantIds },
        run: { is: { status: { in: ['registered', 'running'] } } },
      },
      select: { id: true },
    })
    if (activeParticipant) return null

    const legacyActiveRun = await tx.dungeonRun.findFirst({
      where: {
        heroId: { in: participantIds },
        status: { in: ['registered', 'running'] },
      },
      select: { id: true },
    })
    if (legacyActiveRun) return null

    const run = await tx.dungeonRun.create({
      data: {
        heroId,
        dungeonId: dungeon.id,
        profileId: profile?.id ?? null,
        groupId: groupId ?? null,
        status: 'running',
        participants: {
          create: heroesData.map(participant => ({
            heroId: participant.id,
            profileId: participant.profileId ?? null,
            snapshot: JSON.parse(JSON.stringify(snapshotDungeonParticipant(participant))),
          })),
        },
      },
      select: { id: true },
    })
    return run.id
  })
}
