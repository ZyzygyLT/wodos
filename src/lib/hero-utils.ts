import db from "@/lib/db"
import type { Prisma } from "@/generated/prisma"
import { calcHpMax, calcMpMax } from "@/lib/combat-engine/formulas"

export async function getHeroByUserId(userId: string) {
  return getActiveHeroByUserId(userId, {
    include: {
      class: true,
      race: true,
      skills: { include: { skill: true } },
      items: { include: { item: true }, where: { equipped: true } },
      combatProfiles: { orderBy: { createdAt: "asc" } },
    },
  })
}

export function mergeAttrs(baseAttrs: Record<string, number>, mods: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {}
  const keys = ['st', 'co', 'in', 'dx', 'ch', 'ag', 'pe', 'wi']
  for (const k of keys) {
    result[k] = (baseAttrs[k] ?? 0) + (mods[k] ?? 0)
  }
  return result
}

function buildDefenseDefaults(genericDefense: { id: number; defenseCategory: string | null }[], classDefense: { id: number; defenseCategory: string | null } | null): Record<string, number | null> {
  const slugToId: Record<string, number> = {}
  for (const s of genericDefense) {
    if (s.defenseCategory) slugToId[s.defenseCategory] = s.id
  }
  const result: Record<string, number | null> = {
    melee: slugToId['melee'] ?? null,
    ranged: slugToId['ranged'] ?? null,
    magic: slugToId['magic'] ?? null,
  }
  if (classDefense?.defenseCategory) {
    result[classDefense.defenseCategory] = classDefense.id
  }
  return result
}

export async function createHero(userId: string, name: string, classId: number, raceId: number) {
  const [cls, race] = await Promise.all([
    db.class.findUnique({ where: { id: classId }, include: { skills: true } }),
    db.race.findUnique({ where: { id: raceId } }),
  ])
  if (!cls || !race) throw new Error("Class or race not found")

  const classAttrs = cls.baseAttrs as Record<string, number>
  const raceMods = race.attrMods as Record<string, number>
  const attrs = mergeAttrs(classAttrs, raceMods)
  const hpMax = calcHpMax(attrs as any, 1)
  const mpMax = calcMpMax(attrs as any)

  return db.$transaction(async (tx) => {
    // Serialize hero creation per account so maxHeroes and initial selection cannot race.
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { currentHeroId: true, maxHeroes: true },
    })
    if (!user) throw new Error("USER_NOT_FOUND")

    const heroCount = await tx.hero.count({ where: { userId } })
    if (user.maxHeroes !== null && heroCount >= user.maxHeroes) {
      throw new Error("MAX_HEROES_REACHED")
    }

    const genericDefense = await tx.skill.findMany({
      where: { classId: null, defenseCategory: { not: null } }
    })
    const classDefense = await tx.skill.findFirst({
      where: { classId, defenseCategory: { not: null } }
    })

    const starterSkills = cls.skills.filter(s => s.tier <= 1 || s.goldCost === 0)
    const defaultAttackSkill = starterSkills
      .filter(s => s.type === "active" && s.effect === "attack" && s.tier === 1 && s.manaCost <= mpMax)
      .sort((a, b) => a.manaCost - b.manaCost || a.id - b.id)[0]
    if (!defaultAttackSkill) throw new Error("NO_STARTER_ATTACK_SKILL")

    const defaultHealSkill = starterSkills.find(
      s => s.type === "active" && s.effect === "heal" && s.tier === 1 && s.manaCost <= mpMax
    )
    const roundRules = [
      ...(defaultHealSkill ? [{
        priority: 1,
        condition: { type: "hp_ally_lt", value: 30 },
        action: { skillId: defaultHealSkill.id, targetPos: "auto", targetType: "most_injured_ally" as const },
      }] : []),
      {
        priority: defaultHealSkill ? 2 : 1,
        condition: { type: "always" },
        action: { skillId: defaultAttackSkill.id, targetPos: "front", targetType: "weakest" },
      },
    ]

    const hero = await tx.hero.create({
      data: {
        userId,
        name,
        classId,
        raceId,
        attrs,
        hpMax,
        mpMax,
        hpCurrent: hpMax,
        mpCurrent: mpMax,
        onboardingDone: true,
        freeAttrPoints: 5,
        combatProfiles: {
          create: {
            name: "Estándar",
            position: cls.position,
            defenseSkills: buildDefenseDefaults(genericDefense, classDefense) as any,
            roundRules,
          }
        }
      }
    })
    if (starterSkills.length > 0) {
      await tx.heroSkill.createMany({
        data: starterSkills.map(s => ({ heroId: hero.id, skillId: s.id }))
      })
    }

    const defenseSkillIds = [...new Set([
      ...genericDefense.map(s => s.id),
      ...(classDefense ? [classDefense.id] : []),
    ])]
    await tx.heroSkill.createMany({
      data: defenseSkillIds.map(skillId => ({ heroId: hero.id, skillId })),
      skipDuplicates: true,
    })

    const STARTER_WEAPONS: Record<string, string> = {
      guerrero: 'espada-hierro', paladin: 'espada-hierro', barbaro: 'espada-hierro',
      mago: 'baston-runico', druida: 'baston-runico',
      arquero: 'arco-corto',
      asesino: 'daga-acero', clerigo: 'daga-acero',
    }
    const casterClasses = ['mago', 'druida', 'clerigo']
    const starterArmor = casterClasses.includes(cls.slug) ? 'tunica-lino' : 'armadura-cuero'
    const weaponSlug = STARTER_WEAPONS[cls.slug]
    const starterSlugs = [weaponSlug, starterArmor, 'pocion-vida'].filter(Boolean)

    const starterItems = await tx.item.findMany({
      where: { slug: { in: starterSlugs } },
    })
    if (starterItems.length > 0) {
      await tx.heroItem.createMany({
        data: starterItems.map(item => ({
          heroId: hero.id,
          itemId: item.id,
          equipped: item.slot != null,
          slot: item.slot as any,
        })),
      })
    }

    const currentHero = user.currentHeroId
      ? await tx.hero.findFirst({ where: { id: user.currentHeroId, userId }, select: { id: true } })
      : null
    if (!currentHero) {
      const firstOwnedHero = await tx.hero.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      })
      if (firstOwnedHero) {
        await tx.user.update({ where: { id: userId }, data: { currentHeroId: firstOwnedHero.id } })
      }
    }

    return hero
  })
}


/**
 * Resolves the player's selected hero while enforcing ownership.
 * A stale or missing selection is repaired to the oldest hero owned by the user.
 * The conditional pointer update prevents a concurrent hero switch from being overwritten.
 */
type ActiveHeroOptions = Pick<Prisma.HeroFindFirstArgs, 'include' | 'select'>

export async function getActiveHeroByUserId<T extends ActiveHeroOptions = ActiveHeroOptions>(
  userId: string,
  options: T = {} as T,
): Promise<Prisma.HeroGetPayload<T> | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { currentHeroId: true },
  })
  if (!user) return null

  const findOwnedHero = async (
    where: Prisma.HeroWhereInput,
    orderBy?: Prisma.HeroOrderByWithRelationInput,
  ) => {
    const base = { where, ...(orderBy ? { orderBy } : {}) }
    if (options.select) {
      return db.hero.findFirst({ ...base, select: options.select })
    }
    if (options.include) {
      return db.hero.findFirst({ ...base, include: options.include })
    }
    return db.hero.findFirst(base)
  }

  if (user.currentHeroId) {
    const activeHero = await findOwnedHero({ id: user.currentHeroId, userId })
    if (activeHero) return activeHero as Prisma.HeroGetPayload<T>
  }

  const fallbackHero = await findOwnedHero(
    { userId },
    { createdAt: "asc" },
  )
  if (!fallbackHero) return null

  const fallbackHeroId = (fallbackHero as { id: string }).id
  const repaired = await db.user.updateMany({
    where: { id: userId, currentHeroId: user.currentHeroId },
    data: { currentHeroId: fallbackHeroId },
  })

  // If another request changed the selection while we were repairing it,
  // return that newly selected hero rather than acting on a stale fallback.
  if (repaired.count === 0) {
    const latestUser = await db.user.findUnique({
      where: { id: userId },
      select: { currentHeroId: true },
    })
    if (latestUser?.currentHeroId) {
      const concurrentlySelectedHero = await findOwnedHero({
        id: latestUser.currentHeroId,
        userId,
      })
      if (concurrentlySelectedHero) {
        return concurrentlySelectedHero as Prisma.HeroGetPayload<T>
      }
    }
  }

  return fallbackHero as Prisma.HeroGetPayload<T>
}

/**
 * Changes the active hero only if it is owned by the authenticated user.
 */
export async function setActiveHeroForUser(userId: string, heroId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const hero = await tx.hero.findFirst({
      where: { id: heroId, userId },
      select: { id: true },
    })
    if (!hero) return false

    await tx.user.update({
      where: { id: userId },
      data: { currentHeroId: hero.id },
    })
    return true
  })
}
