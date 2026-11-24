import db from '@/lib/db'
import type { Prisma } from '@/generated/prisma'
import { runDungeon, HeroData, RunResult } from '@/lib/combat-engine/dungeon-runner'
import { buildHeroData, enrichDungeonLevels, loadGroupParticipants, hasHeroRunDungeonToday, hasGroupRunDungeonToday, snapshotDungeonParticipant } from '@/lib/dungeon-helpers'
import type { LevelUpResult } from '@/lib/level-up'
import { persistRunResult, processPostRun } from '@/services/dungeon-execution.service'
import { calcClanBonuses } from "@/lib/clan/upgrades"
import logger from "@/lib/logger"

type CombatHero = Prisma.HeroGetPayload<{
  include: {
    combatProfiles: true
    skills: { include: { skill: true } }
    items: { include: { item: true } }
  }
}>
type CombatProfile = CombatHero['combatProfiles'][number]
type DungeonRecord = NonNullable<Awaited<ReturnType<typeof db.dungeon.findUnique>>>
type LootItem = Awaited<ReturnType<typeof db.item.findMany>>[number]

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

  const profile = params.profileId
    ? hero.combatProfiles.find(p => p.id === params.profileId) ?? null
    : hero.combatProfiles.find(p => p.dungeonLevel === null) ?? hero.combatProfiles[0] ?? null
  if (params.profileId && !profile) {
    return { ok: false, error: 'Perfil de combate no válido', status: 404 }
  }

  const cm = await db.clanMember.findUnique({ where: { heroId: hero.id } })
  const effectiveGroupId = params.groupId ?? cm?.groupId

  const groupResult = await loadCombatGroup(effectiveGroupId, hero, profile, dungeon.levelReq)
  if (!groupResult.ok) return { ok: false, error: groupResult.error!, status: groupResult.status! }
  const { heroesData, totalHeroes, isGroup } = groupResult

  if (isGroup && !heroesData.some(h => h.combatProfile?.position === 'front')) {
    return { ok: false, error: 'El grupo necesita al menos un héroe en posición frontal', status: 400 }
  }

  const clanInfo = cm
    ? await db.clanMember.findUnique({
        where: { heroId: hero.id },
        include: { clan: { include: { upgrades: true } } },
      })
    : null
  const clanBonuses = clanInfo ? calcClanBonuses(clanInfo.clan.upgrades) : undefined
  const clanMemberRec = clanInfo ? { clanId: clanInfo.clanId, clan: clanInfo.clan } : null
  const dungeonData = await enrichDungeonLevels(dungeon)

  const runId = await createInstantRunReservation(hero.id, dungeon, profile, effectiveGroupId, heroesData)
  if (!runId) {
    return { ok: false, error: 'Uno de los héroes ya está comprometido en otra expedición', status: 409 }
  }

  // Evaluate the daily bonus after reservation so concurrent runs cannot both claim first-of-day.
  let firstOfDay = false
  let result: RunResult
  let levelUps: Array<{ heroId: string; result: LevelUpResult }> = []
  let itemMap: Map<number, LootItem> = new Map()
  try {
    firstOfDay = isGroup
      ? !(await hasGroupRunDungeonToday(heroesData.map(h => h.id)))
      : !(await hasHeroRunDungeonToday(hero.id))
    result = await runDungeon(heroesData, dungeonData, { clanBonuses, groupBonus: isGroup, firstOfDay })
    itemMap = await loadLootItemMap(result)
    const settlement = await db.$transaction(async tx =>
      persistRunResult(tx, { runId, result, heroesData, totalHeroes })
    )
    levelUps = settlement.levelUps
  } catch (error) {
    logger.error('dungeon-registration', 'Instant dungeon execution failed', error)
    await db.dungeonRun.updateMany({
      where: { id: runId, status: 'running' },
      data: { status: 'failed', result: 'defeat', executedAt: new Date(), completesAt: new Date() },
    }).catch(updateError => logger.error('dungeon-registration', 'Could not finalize failed instant run', updateError))
    return { ok: false, error: 'No se pudo completar la expedición. Intentá nuevamente.', status: 500 }
  }

  const levelUp = levelUps.find(entry => entry.heroId === hero.id)?.result
  await processPostRun({ result, heroesData, totalHeroes, dungeon, runId, clanMemberRec, levelUps }).catch(error => {
    logger.error('dungeon-registration', 'Post-run processing failed', error)
  })

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
      levelUp: levelUp?.leveledUp ? levelUp : undefined,
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

  const profile = params.profileId
    ? hero.combatProfiles.find(p => p.id === params.profileId) ?? null
    : hero.combatProfiles.find(p => p.dungeonLevel === null) ?? hero.combatProfiles[0] ?? null
  if (params.profileId && !profile) {
    return { ok: false, error: 'Perfil de combate no válido', status: 404 }
  }
  const profileId = profile?.id ?? null

  const cm = await db.clanMember.findUnique({ where: { heroId: hero.id } })
  const effectiveGroupId = params.groupId ?? cm?.groupId ?? null

  const groupResult = await loadCombatGroup(effectiveGroupId, hero, profile, dungeon.levelReq)
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

    // Reconcile the preloaded snapshot after acquiring participant locks. A potion
    // may have been consumed between loadCombatGroup() and this transaction.
    if (!(await snapshotConsumablesStillExist(tx, groupResult.heroesData))) {
      return { snapshotConflict: true as const }
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
  if ('snapshotConflict' in run) {
    return { ok: false, error: 'El inventario cambió mientras preparabas la expedición. Actualizá y volvé a registrarte.', status: 409 }
  }

  return { ok: true, data: { id: run.id, dungeon: dungeon.name, status: 'registered' } }
}

async function snapshotConsumablesStillExist(
  tx: Prisma.TransactionClient,
  heroesData: HeroData[],
): Promise<boolean> {
  const consumables = heroesData.flatMap(participant =>
    (participant.consumables ?? []).map(item => ({ id: item.heroItemId, heroId: participant.id }))
  )
  if (consumables.length === 0) return true

  const existingItems = await tx.heroItem.findMany({
    where: {
      id: { in: consumables.map(item => item.id) },
      heroId: { in: [...new Set(consumables.map(item => item.heroId))] },
    },
    select: { id: true, heroId: true },
  })
  const existingKeys = new Set(existingItems.map(item => `${item.heroId}:${item.id}`))
  return consumables.every(item => existingKeys.has(`${item.heroId}:${item.id}`))
}

interface CombatGroupResult {
  ok: boolean
  error?: string
  status?: number
  heroesData: HeroData[]
  totalHeroes: number
  isGroup: boolean
}

async function loadCombatGroup(effectiveGroupId: string | null | undefined, hero: CombatHero, profile: CombatProfile | null, levelReq: number): Promise<CombatGroupResult> {
  if (effectiveGroupId) {
    const groupResult = await loadGroupParticipants(effectiveGroupId)
    if (groupResult.heroesData.length === 0) return { ok: false, error: 'Grupo vacío o no encontrado', status: 404, heroesData: [], totalHeroes: 0, isGroup: false }
    if (!groupResult.heroIds.includes(hero.id)) return { ok: false, error: 'Tu héroe no pertenece a este grupo', status: 403, heroesData: [], totalHeroes: 0, isGroup: false }
    for (const h of groupResult.heroesData) {
      if (h.hpCurrent !== undefined && h.hpCurrent <= 0) return { ok: false, error: `${h.name} está derribado y no puede participar`, status: 400, heroesData: [], totalHeroes: 0, isGroup: false }
      if (h.level < levelReq) return { ok: false, error: `${h.name} no tiene nivel suficiente (min ${levelReq})`, status: 400, heroesData: [], totalHeroes: 0, isGroup: false }
    }
    // The initiating hero may explicitly choose a combat profile. Group loading
    // uses each member's default profile, so replace only the leader's snapshot
    // with the already-authorized selection before freezing the party.
    const heroesData = await Promise.all(groupResult.heroesData.map(participant =>
      participant.id === hero.id
        ? buildHeroData(hero, profile ?? hero.combatProfiles?.find(p => p.dungeonLevel === null) ?? hero.combatProfiles?.[0] ?? null)
        : Promise.resolve(participant)
    ))
    return { ok: true, heroesData, totalHeroes: heroesData.length, isGroup: heroesData.length > 1 }
  }
  const heroesData = [await buildHeroData(hero, profile)]
  return { ok: true, heroesData, totalHeroes: 1, isGroup: false }
}

async function loadLootItemMap(result: RunResult): Promise<Map<number, LootItem>> {
  const lootItemIds = [...new Set(result.loot.map(l => l.itemId))]
  if (lootItemIds.length === 0) return new Map()
  const lootItems = await db.item.findMany({ where: { id: { in: lootItemIds } } })
  return new Map(lootItems.map(i => [i.id, i] as const))
}

async function createInstantRunReservation(
  heroId: string,
  dungeon: DungeonRecord,
  profile: CombatProfile | null,
  groupId: string | null | undefined,
  heroesData: HeroData[],
): Promise<string | null> {
  return db.$transaction(async tx => {
    const participantIds = heroesData.map(participant => participant.id)
    for (const participantId of [...participantIds].sort()) {
      await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${participantId} FOR UPDATE`
    }

    // Do not persist a stale consumable snapshot if inventory changed before locks.
    if (!(await snapshotConsumablesStillExist(tx, heroesData))) return null

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
