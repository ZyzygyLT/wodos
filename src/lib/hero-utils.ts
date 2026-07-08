import db from "@/lib/db"
import { calcHpMax, calcMpMax } from "@/lib/combat-engine/formulas"

export async function getHeroByUserId(userId: string) {
  return db.hero.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      class: true,
      race: true,
      skills: { include: { skill: true } },
      items: { include: { item: true }, where: { equipped: true } },
      combatProfiles: { orderBy: { createdAt: "asc" } },
    }
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
    const genericDefense = await tx.skill.findMany({
      where: { classId: null, defenseCategory: { not: null } }
    })
    const classDefense = await tx.skill.findFirst({
      where: { classId, defenseCategory: { not: null } }
    })

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
            initiativeSkill: "organization",
            defenseSkills: buildDefenseDefaults(genericDefense, classDefense) as any,
            roundRules: [
              {
                priority: 1,
                condition: { type: "hp_self_lt", value: 30 },
                action: { skillId: 1, targetPos: "auto", targetType: "most_injured_ally" as const }
              },
              {
                priority: 2,
                condition: { type: "always" },
                action: { skillId: 1, targetPos: "front", targetType: "weakest" }
              }
            ]
          }
        }
      }
    })

    const starterSkills = cls.skills.filter(s => s.tier <= 1 || s.goldCost === 0)
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

    return hero
  })
}
