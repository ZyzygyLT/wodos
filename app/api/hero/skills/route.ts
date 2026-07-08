import { NextRequest, NextResponse } from "next/server"
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

  const allSkills = await db.skill.findMany({
    where: { OR: [{ classId: hero.classId }, { classId: null }] },
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

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { class: true, skills: true }
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const skill = await db.skill.findUnique({ where: { id: parsed.data.skillId } })
  if (!skill) {
    return NextResponse.json({ error: "Skill no encontrada" }, { status: 404 })
  }

  if (skill.classId !== hero.classId) {
    return NextResponse.json({ error: "Esa skill no es de tu clase" }, { status: 400 })
  }

  const alreadyUnlocked = hero.skills.some(s => s.skillId === parsed.data.skillId)
  if (alreadyUnlocked) {
    return NextResponse.json({ error: "Ya tenés esa skill desbloqueada" }, { status: 400 })
  }

  // Validar prerrequisitos
  if (skill.requiresSkills.length > 0) {
    const unlockedIds = new Set(hero.skills.map(s => s.skillId))
    const missing = skill.requiresSkills.filter(id => !unlockedIds.has(id))
    if (missing.length > 0) {
      const missingSkills = await db.skill.findMany({ where: { id: { in: missing } }, select: { name: true } })
      return NextResponse.json({
        error: `Requiere: ${missingSkills.map(s => s.name).join(", ")}`
      }, { status: 400 })
    }
  }

  if (skill.goldCost > 0 && hero.gold < skill.goldCost) {
    return NextResponse.json({
      error: `Oro insuficiente. Necesitás ${skill.goldCost}, tenés ${hero.gold}`
    }, { status: 400 })
  }

  const epAvailable = hero.epTotal - hero.epSpent
  if (skill.epCost > 0 && epAvailable < skill.epCost) {
    return NextResponse.json({
      error: `EXP insuficiente. Necesitás ${skill.epCost} EXP, tenés ${epAvailable} EXP`
    }, { status: 400 })
  }

  const [heroSkill] = await db.$transaction([
    db.heroSkill.create({ data: { heroId: hero.id, skillId: skill.id } }),
    db.hero.update({ where: { id: hero.id }, data: { gold: { decrement: skill.goldCost }, epSpent: { increment: skill.epCost } } }),
  ])

  updateQuestProgress(hero.id, { type: "skills_unlocked" }).catch(() => {})
  checkAchievements(hero.id, { type: "skills_unlocked" }).catch(() => {})

  return NextResponse.json({
    id: heroSkill.id, skillId: skill.id, unlockedAt: heroSkill.unlockedAt,
    goldSpent: skill.goldCost, goldRemaining: hero.gold - skill.goldCost,
    epSpent: skill.epCost, epRemaining: (hero.epTotal - hero.epSpent) - skill.epCost,
  }, { status: 201 })
}
