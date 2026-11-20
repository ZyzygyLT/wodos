import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { auth } from "@/auth"
import db from "@/lib/db"
import { updateQuestProgress } from "@/lib/quests/progress"
import { checkAchievements } from "@/lib/achievements/checker"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"
import { skillUpgradeCost } from "@/lib/skill-cost"

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
      select: { id: true, gold: true, epTotal: true, epSpent: true },
    })
    if (!currentHero) throw new Error("HERO_NOT_FOUND")

    const heroSkill = await tx.heroSkill.findUnique({
      where: { heroId_skillId: { heroId: hero.id, skillId: parsed.data.skillId } },
    })
    if (!heroSkill) throw new Error("SKILL_NOT_UNLOCKED")

    const skill = await tx.skill.findUnique({ where: { id: parsed.data.skillId } })
    if (!skill) throw new Error("SKILL_NOT_FOUND")

    const currentRank = heroSkill.rank
    if (currentRank >= (skill.maxRank ?? 1)) throw new Error("SKILL_MAX_RANK")
    const newRank = currentRank + 1
    const goldCost = skillUpgradeCost(skill.goldCost, currentRank)
    const epCost = skillUpgradeCost(skill.epCost, currentRank)
    const epAvailable = currentHero.epTotal - currentHero.epSpent

    if (currentHero.gold < goldCost) throw new Error("GOLD_INSUFFICIENT")
    if (epAvailable < epCost) throw new Error("EP_INSUFFICIENT")

    const charged = await tx.hero.updateMany({
      where: {
        id: hero.id,
        gold: { gte: goldCost },
        epSpent: { lte: currentHero.epTotal - epCost },
      },
      data: {
        gold: { decrement: goldCost },
        epSpent: { increment: epCost },
      },
    })
    if (charged.count !== 1) throw new Error("RESOURCE_BALANCE_STALE")

    const ranked = await tx.heroSkill.updateMany({
      where: { id: heroSkill.id, rank: currentRank },
      data: { rank: newRank },
    })
    if (ranked.count !== 1) throw new Error("SKILL_RANK_STALE")

    return {
      skillId: skill.id,
      oldRank: currentRank,
      newRank,
      goldCost,
      epCost,
      goldRemaining: currentHero.gold - goldCost,
      epRemaining: epAvailable - epCost,
    }
  }).catch(error => {
    if (!(error instanceof Error)) throw error
    const messages: Record<string, { error: string; status: number }> = {
      HERO_NOT_FOUND: { error: "Héroe no encontrado", status: 404 },
      SKILL_NOT_UNLOCKED: { error: "No tenés esa skill desbloqueada", status: 400 },
      SKILL_NOT_FOUND: { error: "Skill no encontrada", status: 404 },
      SKILL_MAX_RANK: { error: "Ya alcanzaste el rango máximo", status: 400 },
      GOLD_INSUFFICIENT: { error: "Oro insuficiente", status: 400 },
      EP_INSUFFICIENT: { error: "EXP insuficiente", status: 400 },
      RESOURCE_BALANCE_STALE: { error: "Los recursos cambiaron; volvé a intentarlo", status: 409 },
      SKILL_RANK_STALE: { error: "El rango de la habilidad cambió; volvé a intentarlo", status: 409 },
    }
    const mapped = messages[error.message]
    if (!mapped) throw error
    return mapped
  })

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })

  updateQuestProgress(hero.id, { type: "skills_upgraded" }).catch(e => logger.error("api", "Background operation failed", e))
  checkAchievements(hero.id, { type: "skills_upgraded" }).catch(e => logger.error("api", "Background operation failed", e))

  return NextResponse.json(result)
}
