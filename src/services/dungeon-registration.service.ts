import db from '@/lib/db'
import { runDungeon, HeroData, RunResult } from '@/lib/combat-engine/dungeon-runner'
import { buildHeroData, enrichDungeonLevels, loadGroupParticipants, hasHeroRunDungeonToday, hasGroupRunDungeonToday, snapshotDungeonParticipant } from '@/lib/dungeon-helpers'
import { checkLevelUp, LevelUpResult } from '@/lib/level-up'
import { updateQuestProgress } from '@/lib/quests/progress'
import { checkAchievements } from '@/lib/achievements/checker'
import { grantMaterialDrops } from '@/lib/craft/material-drops'
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

  const firstOfDay = isGroup
    ? !(await hasGroupRunDungeonToday(heroesData.map(h => h.id)))
    : !(await hasHeroRunDungeonToday(hero.id))

  const result = await runDungeon(heroesData, dungeonData, { clanBonuses, groupBonus: isGroup, firstOfDay })

  const itemMap = await loadLootItemMap(result)
  const runId = await createRunTransaction(hero.id, dungeon, profile, effectiveGroupId, result, heroesData, totalHeroes)

  const levelUp = await checkLevelUp(hero.id)

  for (const fs of result.heroesFinalState) {
    await grantMaterialDrops(fs.id, dungeon.id, runId).catch(e => logger.error("dungeon-registration", "Background operation failed", e))
    const kills = (result.log as any[])?.filter((l: any) => l.type === 'death').length ?? 0
    await updateQuestProgress(fs.id, { type: 'dungeon_complete', dungeonSlug: dungeon.slug, kills, sourceRunId: runId }).catch(e => logger.error("dungeon-registration", "Background operation failed", e))
    if (kills > 0) await updateQuestProgress(fs.id, { type: 'total_kills', kills, sourceRunId: runId }).catch(e => logger.error("dungeon-registration", "Background operation failed", e))
    await updateQuestProgress(fs.id, { type: 'ep_total', value: result.epGained / totalHeroes, sourceRunId: runId }).catch(e => logger.error("dungeon-registration", "Background operation failed", e))
    checkAchievements(fs.id, { type: 'dungeon_complete' }).catch(e => logger.error("dungeon-registration", "Background operation failed", e))
  }

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

  const run = await db.$transaction(async tx => {
    // Serialize registrations for the same initiating hero to prevent duplicate active runs.
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${hero.id} FOR UPDATE`

    const prevRun = await tx.dungeonRun.findFirst({
      where: { heroId: hero.id, status: 'registered' },
    })
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

async function createRunTransaction(heroId: string, dungeon: any, profile: any, effectiveGroupId: string | null | undefined, result: any, heroesData: HeroData[], totalHeroes: number) {
  let runId = ''
  await db.$transaction(async (tx) => {
    const run = await tx.dungeonRun.create({
      data: {
        heroId, dungeonId: dungeon.id,
        profileId: profile?.id ?? null,
        groupId: effectiveGroupId ?? null,
        participants: {
          create: heroesData.map(participant => ({
            heroId: participant.id,
            profileId: participant.profileId ?? null,
            snapshot: JSON.parse(JSON.stringify(participant)),
          })),
        },
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
    runId = run.id

    for (const heroData of heroesData) {
      const consumedIds = heroData.consumedConsumableIds ?? []
      if (consumedIds.length === 0) continue
      const consumed = await tx.heroItem.deleteMany({ where: { id: { in: consumedIds }, heroId: heroData.id } })
      if (consumed.count !== consumedIds.length) throw new Error('DUNGEON_CONSUMABLE_INVENTORY_MISMATCH')
    }

    for (const fs of result.heroesFinalState) {
      const hData = heroesData.find((h: any) => h.id === fs.id)
      if (!hData) continue
      await tx.hero.update({
        where: { id: fs.id },
        data: {
          epTotal: { increment: result.epGained / totalHeroes },
          gold: { increment: result.goldGained / totalHeroes },
          fame: { increment: Math.ceil(result.fameGained / totalHeroes) },
          hpCurrent: fs.hp,
          mpCurrent: fs.mp,
        },
      })
    }

    if (result.loot && result.loot.length > 0) {
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
              heroId: hId, itemId: l.itemId, equipped: false,
            }))
          ),
        })
      }
    }
  })
  return runId
}
