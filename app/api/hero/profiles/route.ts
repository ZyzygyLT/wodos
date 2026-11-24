import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { getDefaultCombatSkillId } from "@/engine/core/skills/skill-availability"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"

const POSITIONS = ['front', 'center', 'rear', 'left_flank', 'right_flank', 'flexible'] as const

const createSchema = z.object({
  name: z.string().min(1).max(40),
  position: z.enum(POSITIONS).default('front'),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, {
    include: { combatProfiles: { orderBy: { createdAt: "asc" } } },
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  return NextResponse.json(hero.combatProfiles)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, {
    include: { skills: { include: { skill: true } } },
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const skills = (hero.skills ?? []).map(({ skill }) => ({
    skillId: skill.id,
    type: skill.type,
    effect: skill.effect,
    manaCost: skill.manaCost,
  }))
  const defaultSkillId = getDefaultCombatSkillId(skills)
  const healingSkill = skills.find(skill => skill.type !== 'passive' && skill.effect === 'heal')
  const roundRules = [
    ...(healingSkill ? [{
      priority: 1,
      condition: { type: "hp_self_lt", value: 30 },
      action: { skillId: healingSkill.skillId, targetPos: "auto", targetType: "most_injured_ally" },
    }] : []),
    {
      priority: healingSkill ? 2 : 1,
      condition: { type: "always" },
      action: { skillId: defaultSkillId, targetPos: "auto", targetType: "weakest" },
    },
  ]

  const profile = await db.combatProfile.create({
    data: {
      heroId: hero.id,
      name: parsed.data.name,
      position: parsed.data.position,
      roundRules,
    }
  })

  return NextResponse.json(profile, { status: 201 })
}
