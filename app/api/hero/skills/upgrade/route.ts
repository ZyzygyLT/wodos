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

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      skills: true,
    }
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const heroSkill = hero.skills.find(s => s.skillId === parsed.data.skillId)
  if (!heroSkill) {
    return NextResponse.json({ error: "No tenés esa skill desbloqueada" }, { status: 400 })
  }

  const skill = await db.skill.findUnique({ where: { id: parsed.data.skillId } })
  if (!skill) {
    return NextResponse.json({ error: "Skill no encontrada" }, { status: 404 })
  }

  const currentRank = heroSkill.rank
  if (currentRank >= (skill.maxRank ?? 1)) {
    return NextResponse.json({ error: `Ya alcanzaste el rango máximo (${skill.maxRank ?? 1})` }, { status: 400 })
  }
  const newRank = currentRank + 1

  const goldCost = skillUpgradeCost(skill.goldCost, currentRank)
  const epCost = skillUpgradeCost(skill.epCost, currentRank)

  if (hero.gold < goldCost) {
    return NextResponse.json({
      error: `Oro insuficiente. Necesitás ${goldCost}💰, tenés ${hero.gold}💰`
    }, { status: 400 })
  }

  const epAvailable = hero.epTotal - hero.epSpent
  if (epAvailable < epCost) {
    return NextResponse.json({
      error: `EXP insuficiente. Necesitás ${epCost} EXP, tenés ${epAvailable} EXP`
    }, { status: 400 })
  }

  await db.$transaction([
    db.heroSkill.update({
      where: { id: heroSkill.id },
      data: { rank: newRank },
    }),
    db.hero.update({
      where: { id: hero.id },
      data: {
        gold: { decrement: goldCost },
        epSpent: { increment: epCost },
      },
    }),
  ])

  updateQuestProgress(hero.id, { type: "skills_upgraded" }).catch(e => logger.error("api", "Background operation failed", e))
  checkAchievements(hero.id, { type: "skills_upgraded" }).catch(e => logger.error("api", "Background operation failed", e))

  return NextResponse.json({
    skillId: skill.id,
    oldRank: currentRank,
    newRank,
    goldCost,
    epCost,
    goldRemaining: hero.gold - goldCost,
    epRemaining: (hero.epTotal - hero.epSpent) - epCost,
  })
}
