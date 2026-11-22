import db from '@/lib/db'
import { asEntityId } from '@/engine/core'
import {
  calculateHeroStatsFromPersistedItems,
  createWodosRuneResolver,
  resolveWodosStatOverrideBonus,
  resolveWodosUpgradeBonus,
  type PersistedHeroItem,
} from '@/engine/adapters'
import { HeroData, DungeonData, EnemySkillRef } from '@/lib/combat-engine/dungeon-runner'

export function mergeHeroAttrs(heroData: Pick<HeroData, 'attrs' | 'equipStats'>): Record<string, number> {
  const merged: Record<string, number> = {}
  const keys = ['st', 'co', 'in', 'dx', 'ch', 'ag', 'pe', 'wi']
  for (const k of keys) {
    merged[k] = (heroData.attrs[k] ?? 0) + (heroData.equipStats?.[k] ?? 0)
  }
  return merged
}

async function loadHeroWithCombatData(heroId: string): Promise<any> {
  return db.hero.findFirst({
    where: { id: heroId },
    include: {
      combatProfiles: { where: { dungeonLevel: null }, take: 1 },
      skills: { include: { skill: true } },
      items: { include: { item: true } },
    },
  })
}

export async function hasHeroRunDungeonToday(heroId: string): Promise<boolean> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const count = await db.dungeonRun.count({
    where: {
      OR: [
        { heroId },
        { participants: { some: { heroId } } },
      ],
      status: 'done',
      createdAt: { gte: todayStart },
    },
  })
  return count > 0
}

export async function hasGroupRunDungeonToday(heroIds: string[]): Promise<boolean> {
  if (heroIds.length === 0) return false
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const count = await db.dungeonRun.count({
    where: {
      OR: [
        { heroId: { in: heroIds } },
        { participants: { some: { heroId: { in: heroIds } } } },
      ],
      status: 'done',
      createdAt: { gte: todayStart },
    },
  })
  return count > 0
}

export async function loadGroupParticipants(groupId: string): Promise<{ heroesData: HeroData[]; heroIds: string[] }> {
  // Try independent groups first (GroupMember)
  const groupMembers = await db.groupMember.findMany({
    where: { groupId },
    orderBy: { joinedAt: 'asc' },
    include: {
      hero: {
        include: {
          combatProfiles: { orderBy: { createdAt: 'asc' } },
          skills: { include: { skill: true } },
          items: { include: { item: true } },
        },
      },
    },
  })

  if (groupMembers.length > 0) {
    let heroesData = await Promise.all(groupMembers.map(async (m) => {
      const p = m.hero.combatProfiles?.[0] ?? null
      return buildHeroData(m.hero, p)
    }))
    // Deduplicar por ID por si hay miembros repetidos
    const seen = new Set<string>()
    heroesData = heroesData.filter(h => { const key = h.id; if (seen.has(key)) { return false; } seen.add(key); return true })
    return { heroesData, heroIds: heroesData.map(h => h.id) }
  }

  // Fallback: clan groups (ClanMember)
  const clanGroup = await db.clanGroup.findUnique({
    where: { id: groupId },
    include: {
      members: {
        orderBy: { joinedAt: 'asc' },
        include: {
          hero: {
            include: {
              combatProfiles: { orderBy: { createdAt: 'asc' } },
              skills: { include: { skill: true } },
              items: { include: { item: true } },
            },
          },
        },
      },
    },
  })

  if (clanGroup && clanGroup.members.length > 0) {
    let heroesData = await Promise.all(clanGroup.members.map(async (m) => {
      const p = m.hero.combatProfiles?.[0] ?? null
      return buildHeroData(m.hero, p)
    }))
    const seen = new Set<string>()
    heroesData = heroesData.filter(h => { const key = h.id; if (seen.has(key)) { return false; } seen.add(key); return true })
    return { heroesData, heroIds: heroesData.map(h => h.id) }
  }

  return { heroesData: [], heroIds: [] }
}

export function snapshotDungeonParticipant(participant: HeroData): HeroData {
  return JSON.parse(JSON.stringify(participant)) as HeroData
}

export function restoreDungeonParticipantSnapshots(
  participants: Array<{ snapshot: unknown }>
): HeroData[] | null {
  if (participants.length === 0) return null

  const snapshots = participants.map(({ snapshot }) => snapshot as HeroData)
  const ids = snapshots.map(participant => participant?.id)
  if (
    snapshots.some(participant =>
      !participant ||
      typeof participant.id !== 'string' ||
      !participant.combatProfile ||
      !Array.isArray(participant.skills) ||
      typeof participant.hpCurrent !== 'number' ||
      typeof participant.mpCurrent !== 'number'
    ) ||
    new Set(ids).size !== ids.length
  ) {
    return null
  }

  return snapshots
}

export async function buildHeroData(hero: any, profile: any): Promise<HeroData> {
  const hpMax = hero.hpMax
  const mpMax = hero.mpMax
  const attrs = { ...(hero.attrs as Record<string, number>) }
  const manaShield = hero.skills.some((hs: any) => hs.skill.effect === 'mana_shield')

  const runeItemIds = Array.from(new Set<number>(
    (hero.items ?? []).filter((hi: any) => hi.equipped).flatMap((hi: any) => (hi.runesIn as any[] ?? []).map((r: any) => r.itemId))
  ))
  const runeItems = runeItemIds.length > 0
    ? await db.item.findMany({ where: { id: { in: runeItemIds } } })
    : []
  const runeStatsByItemId = new Map<number, Record<string, unknown>>(
    runeItems.map(ri => [ri.id, (ri.stats ?? {}) as Record<string, unknown>] as const)
  )

  const equipStats = calculateHeroStatsFromPersistedItems({
    heroId: asEntityId(hero.id),
    baseStats: {},
    items: (hero.items ?? []) as unknown as PersistedHeroItem[],
    itemResolvers: {
      resolveStatOverrides: resolveWodosStatOverrideBonus,
      resolveUpgrade: resolveWodosUpgradeBonus,
      resolveRunes: createWodosRuneResolver(runeStatsByItemId),
    },
  }).values

  return {
    id: hero.id,
    profileId: profile?.id ?? undefined,
    name: hero.name,
    level: hero.level,
    attrs,
    hpMax,
    mpMax,
    hpCurrent: hero.hpCurrent,
    mpCurrent: hero.mpCurrent,
    gold: hero.gold,
    manaShield,
    combatProfile: {
      position: profile?.position ?? 'front',
      prelimRules: (profile?.prelimRules ?? []) as any[],
      roundRules: (profile?.roundRules ?? [
        { priority: 1, condition: { type: 'hp_self_lt', value: 30 }, action: { skillId: hero.skills[0]?.skill.id ?? 1, targetPos: 'auto', targetType: 'weakest' } },
        { priority: 2, condition: { type: 'always' }, action: { skillId: hero.skills[0]?.skill.id ?? 1, targetPos: 'front', targetType: 'weakest' } },
      ]),
      defenseSkills: (profile?.defenseSkills ?? {}) as Record<string, number | null>,
    },
    skills: hero.skills.map((hs: any) => ({
      skillId: hs.skill.id,
      name: hs.skill.name,
      icon: hs.skill.icon,
      multiplier: hs.skill.multiplier,
      manaCost: hs.skill.manaCost,
      effect: hs.skill.effect,
      rank: hs.rank,
      formula: hs.skill.formula ?? undefined,
      tags: hs.skill.tags,
      cooldownRounds: hs.skill.cooldownRounds ?? 0,
      ...(hs.skill.effect === 'heal' ? { healPct: hs.skill.formula?.healPct ?? 20 } : {}),
    })),
    equipStats,
    consumables: (hero.items ?? [])
      .filter((hi: any) => hi.item.category === 'consumable' && ((hi.item.stats as Record<string, number>)?.healHp != null || (hi.item.stats as Record<string, number>)?.healMp != null))
      .map((hi: any) => {
        const stats = hi.item.stats as Record<string, number> ?? {}
        return { heroItemId: hi.id, itemId: hi.item.id, healHp: stats.healHp, healMp: stats.healMp }
      }),
  }
}

export async function enrichDungeonLevels(dungeon: any): Promise<DungeonData> {
  const rawLevels = dungeon.levels as any[]
  const allEnemyIds = [...new Set(rawLevels.flatMap((l: any) => (l.enemies ?? []).map((e: any) => e.id)))]
  const dbEnemies = allEnemyIds.length > 0
    ? await db.enemy.findMany({ where: { id: { in: allEnemyIds } } })
    : []
  const enemyMap = new Map(dbEnemies.map(e => [e.id, e]))

  const allSkillIds = [...new Set(dbEnemies.flatMap(e => e.skillIds ?? []))]
  const dbSkills = allSkillIds.length > 0
    ? await db.skill.findMany({ where: { id: { in: allSkillIds } } })
    : []
  const skillMap = new Map(dbSkills.map(s => [s.id, s]))

  const enrichedLevels = rawLevels.map((lvl: any) => ({
    number: lvl.number,
    enemies: ((lvl.enemies ?? []) as any[]).flatMap((entry: any) => {
      const dbE = enemyMap.get(entry.id)
      if (!dbE) return []
      const cnt = entry.count ?? 1
      const skillIds = dbE.skillIds ?? []
      const skills: EnemySkillRef[] = []
      for (const sid of skillIds) {
        const s = skillMap.get(sid)
        if (!s) continue
        skills.push({
          skillId: s.id,
          name: s.name,
          icon: s.icon,
          effect: s.effect,
          multiplier: s.multiplier,
          manaCost: s.manaCost,
          cooldownRounds: s.cooldownRounds,
          formula: s.formula as any,
          damageType: (s.formula as any)?.damageType ?? dbE.damageType ?? 'physical',
          attackCategory: s.attackCategory ?? undefined,
          defenseCategory: s.defenseCategory ?? undefined,
        })
      }
      return Array.from({ length: cnt }, () => ({
        id: dbE.id, name: dbE.name, icon: dbE.icon,
        hp: dbE.hp, mp: dbE.mp, atk: dbE.atk, def: dbE.def,
        dx: dbE.dx, ag: dbE.ag, level: dbE.level,
        baseLevel: dbE.baseLevel ?? dbE.level,
        growthFactor: dbE.growthFactor ?? undefined,
        position: entry.pos ?? dbE.position,
        isTrap: entry.isTrap ?? false,
        isBoss: entry.isBoss ?? false,
        passiveEffects: entry.passiveEffects ?? undefined,
        ai: (dbE.ai as { type: string }) ?? undefined,
        faction: dbE.faction ?? undefined,
        skillName: skills.length > 0 ? skills[0].name : dbE.name,
        skillIcon: skills.length > 0 ? skills[0].icon : dbE.icon,
        skillIds,
        skills,
        damageType: skills.length > 0 ? (skills[0].damageType as any) : (dbE.damageType as any) ?? 'physical',
        armorName: '',
      }))
    }),
    epReward: lvl.epReward,
    goldReward: lvl.goldReward,
    locationName: lvl.locationName,
  })) as unknown as DungeonData['levels']

  const lootTable = dungeon.lootTable as unknown as DungeonData['lootTable']

  return {
    id: dungeon.id,
    name: dungeon.name,
    levels: enrichedLevels,
    epReward: dungeon.epReward,
    goldReward: dungeon.goldReward,
    fameReward: dungeon.fameReward,
    lootTable,
    recommendedLevel: dungeon.recommendedLevel,
    difficulty: dungeon.difficulty,
  }
}
