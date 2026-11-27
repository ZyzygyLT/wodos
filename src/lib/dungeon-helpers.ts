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
import { getDefaultCombatSkillId } from '@/engine/core/skills/skill-availability'
import { calculateEffectiveResourceMaxima } from '@/engine/core/stats/derived-stats'
import type { SkillFormula } from '@/lib/combat-engine/formulas'

export function mergeHeroAttrs(heroData: Pick<HeroData, 'attrs' | 'equipStats'>): Record<string, number> {
  const merged: Record<string, number> = {}
  const keys = ['st', 'co', 'in', 'dx', 'ch', 'ag', 'pe', 'wi']
  for (const k of keys) {
    merged[k] = (heroData.attrs[k] ?? 0) + (heroData.equipStats?.[k] ?? 0)
  }
  return merged
}

const LEGACY_ATTACK_EFFECTS = new Set(['attack', 'aoe_attack', 'critical_attack', 'armor_penetration'])

/**
 * Converts older seeded attack formulas into the attribute-based formula consumed by the current engine.
 * Explicit modern formulas remain untouched; only legacy formulas with no effective base are inferred.
 */
export function normalizeLegacyCombatFormula(
  formula: unknown,
  effect: string,
  tags: readonly string[] | null | undefined,
  multiplier: number,
  attributes: Record<string, number>,
): SkillFormula | undefined {
  if (!formula || typeof formula !== 'object' || Array.isArray(formula)) return undefined
  if (!LEGACY_ATTACK_EFFECTS.has(effect)) return formula as SkillFormula

  const raw = formula as Record<string, unknown>
  const rawCoefficients = raw.attrCoeffs
  const hasCoefficients = rawCoefficients !== null
    && typeof rawCoefficients === 'object'
    && !Array.isArray(rawCoefficients)
    && Object.keys(rawCoefficients).length > 0
  const hasExplicitBase = (typeof raw.flatBonus === 'number' && raw.flatBonus !== 0)
    || (typeof raw.skillRankCoeff === 'number' && raw.skillRankCoeff !== 0)
  if (hasCoefficients || hasExplicitBase) return formula as SkillFormula

  const tagSet = new Set(tags ?? [])
  let baseCoefficients: Record<string, number>
  if (tagSet.has('melee')) {
    const primaryAttribute = (attributes.ag ?? 0) > (attributes.st ?? 0) ? 'ag' : 'st'
    baseCoefficients = { [primaryAttribute]: 1.2, dx: 0.6 }
  } else if (tagSet.has('ranged')) {
    baseCoefficients = { dx: 1.2, pe: 0.6 }
  } else if (tagSet.has('magic')) {
    baseCoefficients = { in: 1.2, wi: 0.6 }
  } else {
    baseCoefficients = { st: 1, dx: 0.5 }
  }

  const scale = Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1
  const attrCoeffs = Object.fromEntries(
    Object.entries(baseCoefficients).map(([attribute, coefficient]) => [attribute, coefficient * scale]),
  )
  return {
    ...raw,
    attrCoeffs,
    skillRankCoeff: typeof raw.skillRankCoeff === 'number' ? raw.skillRankCoeff : 0,
    flatBonus: typeof raw.flatBonus === 'number' ? raw.flatBonus : 0,
  } as unknown as SkillFormula
}

/** Maps both current and legacy item-stat names into combat-engine consumable fields. */
export function normalizeConsumableStats(
  stats: unknown,
): { healHp?: number; healMp?: number } | null {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return null
  const raw = stats as Record<string, unknown>
  const hpValue = typeof raw.healHp === 'number' ? raw.healHp : raw.heal
  const mpValue = typeof raw.healMp === 'number' ? raw.healMp : raw.mana
  const healHp = typeof hpValue === 'number' && Number.isFinite(hpValue) && hpValue > 0
    ? hpValue
    : undefined
  const healMp = typeof mpValue === 'number' && Number.isFinite(mpValue) && mpValue > 0
    ? mpValue
    : undefined
  return healHp === undefined && healMp === undefined ? null : { healHp, healMp }
}

async function loadHeroWithCombatData(heroId: string): Promise<any> {
  return db.hero.findFirst({
    where: { id: heroId },
    include: {
      combatProfiles: { orderBy: { createdAt: 'asc' } },
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

export async function loadGroupParticipants(groupId: string, options: BuildHeroDataOptions = {}): Promise<{ heroesData: HeroData[]; heroIds: string[] }> {
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
      const p = m.hero.combatProfiles?.find(candidate => candidate.dungeonLevel === null) ?? m.hero.combatProfiles?.[0] ?? null
      return buildHeroData(m.hero, p, options)
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
      const p = m.hero.combatProfiles?.find(candidate => candidate.dungeonLevel === null) ?? m.hero.combatProfiles?.[0] ?? null
      return buildHeroData(m.hero, p, options)
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

export async function reconcileDungeonParticipantConsumables(heroesData: HeroData[]): Promise<void> {
  const consumables = heroesData.flatMap(hero =>
    (hero.consumables ?? []).map(item => ({ heroId: hero.id, heroItemId: item.heroItemId }))
  )
  if (consumables.length === 0) return

  const existingItems = await db.heroItem.findMany({
    where: {
      id: { in: consumables.map(item => item.heroItemId) },
      heroId: { in: [...new Set(consumables.map(item => item.heroId))] },
    },
    select: { id: true, heroId: true },
  })
  const existingKeys = new Set(existingItems.map(item => `${item.heroId}:${item.id}`))

  // A scheduled expedition keeps its registered build, but cannot consume an
  // inventory row that the player removed before the scheduled execution.
  for (const hero of heroesData) {
    hero.consumables = (hero.consumables ?? []).filter(item =>
      existingKeys.has(`${hero.id}:${item.heroItemId}`)
    )
  }
}

export interface BuildHeroDataOptions {
  /** Starts a new expedition at its effective maximum HP instead of persisted outside HP. */
  fullHealth?: boolean
  /** Restores the temporary HP carried by an ongoing expedition. */
  hpCurrent?: number
}

export async function buildHeroData(hero: any, profile: any, options: BuildHeroDataOptions = {}): Promise<HeroData> {
  const combatProfiles = (hero.combatProfiles ?? []) as Array<{
    id: string
    dungeonLevel: number | null
    position: string
    initiativeSkill?: string
    prelimRules: unknown
    roundRules: unknown
    defenseSkills: unknown
  }>
  const generalProfile = combatProfiles.find(candidate => candidate.dungeonLevel === null) ?? null
  const baseProfile = profile?.dungeonLevel == null
    ? profile ?? generalProfile
    : generalProfile ?? profile ?? null
  const levelOverrides = Object.fromEntries(
    combatProfiles
      .filter(candidate => candidate.dungeonLevel !== null)
      .map(candidate => [candidate.dungeonLevel, {
        position: candidate.position,
        initiativeSkill: candidate.initiativeSkill,
        prelimRules: candidate.prelimRules as Array<{ skillId?: number; itemId?: number }>,
        roundRules: candidate.roundRules as HeroData['combatProfile']['roundRules'],
        defenseSkills: candidate.defenseSkills as HeroData['combatProfile']['defenseSkills'],
      }])
  )
  const hpMax = hero.hpMax
  const mpMax = hero.mpMax
  const attrs = { ...(hero.attrs as Record<string, number>) }
  const manaShield = hero.skills.some((hs: any) => hs.skill.effect === 'mana_shield')
  const defaultSkillId = getDefaultCombatSkillId(hero.skills.map((hs: { skill: { id: number; type: 'active' | 'passive' | 'basic'; effect: string; manaCost: number } }) => ({
    skillId: hs.skill.id,
    type: hs.skill.type,
    effect: hs.skill.effect,
    manaCost: hs.skill.manaCost,
  })))

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
  const effectiveAttrs = mergeHeroAttrs({ attrs, equipStats })
  const effectiveResources = calculateEffectiveResourceMaxima({
    baseHpMax: hpMax,
    baseMpMax: mpMax,
    level: hero.level,
    baseAttributes: attrs,
    effectiveAttributes: effectiveAttrs,
    equipmentHp: equipStats.hp,
    equipmentMp: equipStats.mp,
    skillEffects: hero.skills.map((hs: any) => hs.skill.effect),
  })
  const expeditionHp = Number.isFinite(options.hpCurrent)
    ? Math.max(0, Math.min(effectiveResources.hpMax, options.hpCurrent!))
    : options.fullHealth
      ? effectiveResources.hpMax
      : hero.hpCurrent

  return {
    id: hero.id,
    profileId: profile?.id ?? baseProfile?.id ?? undefined,
    name: hero.name,
    level: hero.level,
    attrs,
    hpMax,
    mpMax,
    hpCurrent: expeditionHp,
    mpCurrent: hero.mpCurrent,
    gold: hero.gold,
    manaShield,
    combatProfile: {
      position: baseProfile?.position ?? 'front',
      initiativeSkill: baseProfile?.initiativeSkill ?? 'organization',
      prelimRules: (baseProfile?.prelimRules ?? []) as any[],
      roundRules: (baseProfile?.roundRules ?? [
        { priority: 1, condition: { type: 'hp_self_lt', value: 30 }, action: { skillId: defaultSkillId, targetPos: 'auto', targetType: 'weakest' } },
        { priority: 2, condition: { type: 'always' }, action: { skillId: defaultSkillId, targetPos: 'front', targetType: 'weakest' } },
      ]),
      defenseSkills: (baseProfile?.defenseSkills ?? {}) as Record<string, number | null>,
      levelOverrides,
    },
    skills: hero.skills.map((hs: any) => ({
      skillId: hs.skill.id,
      slug: hs.skill.slug,
      type: hs.skill.type,
      name: hs.skill.name,
      icon: hs.skill.icon,
      multiplier: hs.skill.multiplier,
      manaCost: hs.skill.manaCost,
      effect: hs.skill.effect,
      rank: hs.rank,
      formula: normalizeLegacyCombatFormula(
        hs.skill.formula,
        hs.skill.effect,
        Array.isArray(hs.skill.tags) ? hs.skill.tags.filter((tag: unknown): tag is string => typeof tag === 'string') : [],
        hs.skill.multiplier,
        effectiveAttrs,
      ),
      tags: hs.skill.tags,
      cooldownRounds: hs.skill.cooldownRounds ?? 0,
      ...(hs.skill.effect === 'heal' ? { healPct: hs.skill.formula?.healPct ?? 20 } : {}),
    })),
    equipStats,
    consumables: (hero.items ?? []).flatMap((hi: any) => {
      if (hi.item.category !== 'consumable') return []
      const healing = normalizeConsumableStats(hi.item.stats)
      if (!healing) return []
      return [{ heroItemId: hi.id, itemId: hi.item.id, ...healing }]
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
          type: s.type,
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
        dx: dbE.dx, ag: dbE.ag, pe: dbE.pe, level: dbE.level,
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
