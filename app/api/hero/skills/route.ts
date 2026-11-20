import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { auth } from "@/auth"
import db from "@/lib/db"
import { updateQuestProgress } from "@/lib/quests/progress"
import { checkAchievements } from "@/lib/achievements/checker"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      skills: { include: { skill: true } },
    }
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const heroSkillMap = new Map(hero.skills.map(hs => [hs.skillId, hs]))

  const allowedRaceIds = hero.raceId ? [hero.raceId] : []
  const allSkills = await db.skill.findMany({
    where: {
      OR: [{ classId: hero.classId }, { classId: null }],
      AND: [{ OR: [{ raceReq: { isEmpty: true } }, { raceReq: { hasSome: allowedRaceIds } }] }],
    },
    orderBy: [{ tier: "asc" }, { id: "asc" }],
  })

  return NextResponse.json(
    allSkills.map(s => {
      const hs = heroSkillMap.get(s.id)
      return {
        id: s.id,
        name: s.name,
        slug: s.slug,
        icon: s.icon,
        type: s.type,
        timing: s.timing,
        tier: s.tier,
        description: s.description,
        effect: s.effect,
        goldCost: s.goldCost,
        manaCost: s.manaCost,
        epCost: s.epCost,
        multiplier: s.multiplier,
        tags: s.tags,
        formula: s.formula,
        defenseCategory: s.defenseCategory,
        requiresSkills: s.requiresSkills,
        unlocked: !!hs,
        rank: hs?.rank ?? 0,
      }
    })
  )
}

const schema = z.object({
  skillId: z.number().int().positive(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!hero) return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })

  const result = await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${hero.id} FOR UPDATE`

    const currentHero = await tx.hero.findUnique({
      where: { id: hero.id },
      select: { id: true, classId: true, gold: true, epTotal: true, epSpent: true },
    })
    if (!currentHero) throw new Error("HERO_NOT_FOUND")

    const skill = await tx.skill.findUnique({ where: { id: parsed.data.skillId } })
    if (!skill) throw new Error("SKILL_NOT_FOUND")
    if (skill.classId !== currentHero.classId) throw new Error("SKILL_WRONG_CLASS")

    const existing = await tx.heroSkill.findUnique({
      where: { heroId_skillId: { heroId: hero.id, skillId: skill.id } },
    })
    if (existing) throw new Error("SKILL_ALREADY_UNLOCKED")

    if (skill.requiresSkills.length > 0) {
      const unlocked = await tx.heroSkill.findMany({
        where: { heroId: hero.id },
        select: { skillId: true },
      })
      const unlockedIds = new Set(unlocked.map(item => item.skillId))
      if (skill.requiresSkills.some(id => !unlockedIds.has(id))) {
        throw new Error("SKILL_PREREQUISITES_MISSING")
      }
    }

    const epAvailable = currentHero.epTotal - currentHero.epSpent
    if (currentHero.gold < skill.goldCost) throw new Error("GOLD_INSUFFICIENT")
    if (epAvailable < skill.epCost) throw new Error("EP_INSUFFICIENT")

    const charged = await tx.hero.updateMany({
      where: {
        id: hero.id,
        gold: { gte: skill.goldCost },
        epSpent: { lte: currentHero.epTotal - skill.epCost },
      },
      data: {
        gold: { decrement: skill.goldCost },
        epSpent: { increment: skill.epCost },
      },
    })
    if (charged.count !== 1) throw new Error("RESOURCE_BALANCE_STALE")

    const heroSkill = await tx.heroSkill.create({
      data: { heroId: hero.id, skillId: skill.id },
    })

    return {
      id: heroSkill.id,
      skillId: skill.id,
      unlockedAt: heroSkill.unlockedAt,
      goldSpent: skill.goldCost,
      goldRemaining: currentHero.gold - skill.goldCost,
      epSpent: skill.epCost,
      epRemaining: epAvailable - skill.epCost,
    }
  }).catch(error => {
    if (!(error instanceof Error)) throw error
    const messages: Record<string, { error: string; status: number }> = {
      HERO_NOT_FOUND: { error: "Héroe no encontrado", status: 404 },
      SKILL_NOT_FOUND: { error: "Skill no encontrada", status: 404 },
      SKILL_WRONG_CLASS: { error: "Esa skill no es de tu clase", status: 400 },
      SKILL_ALREADY_UNLOCKED: { error: "Ya tenés esa skill desbloqueada", status: 409 },
      SKILL_PREREQUISITES_MISSING: { error: "No cumplís los prerrequisitos de esa skill", status: 400 },
      GOLD_INSUFFICIENT: { error: "Oro insuficiente", status: 400 },
      EP_INSUFFICIENT: { error: "EXP insuficiente", status: 400 },
      RESOURCE_BALANCE_STALE: { error: "Los recursos cambiaron; volvé a intentarlo", status: 409 },
    }
    const mapped = messages[error.message]
    if (!mapped) throw error
    return mapped
  })

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })

  updateQuestProgress(hero.id, { type: "skills_unlocked" }).catch(e => logger.error("api", "Background operation failed", e))
  checkAchievements(hero.id, { type: "skills_unlocked" }).catch(e => logger.error("api", "Background operation failed", e))

  return NextResponse.json(result, { status: 201 })
}
