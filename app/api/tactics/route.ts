import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"

const POSITIONS = ['front', 'center', 'rear', 'left_flank', 'right_flank', 'flexible'] as const

const putSchema = z.object({
  dungeonLevel: z.number().int().positive().nullable().optional(),
  position: z.enum(POSITIONS).optional(),
  initiativeSkill: z.string().optional(),
  defenseSkills: z.record(z.string(), z.number().int().nullable()).optional(),
  prelimRules: z.array(z.any()).optional(),
  roundRules: z.array(z.any()).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    include: { skills: { include: { skill: true } } },
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const profiles = await db.combatProfile.findMany({
    where: { heroId: hero.id },
    orderBy: [{ dungeonLevel: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],
  })

  return NextResponse.json({
    profiles,
    attrs: hero.attrs,
    heroLevel: hero.level,
    skills: hero.skills.map(hs => ({
      id: hs.skill.id,
      name: hs.skill.name,
      icon: hs.skill.icon,
      defenseCategory: hs.skill.defenseCategory,
      rank: hs.rank,
      formula: hs.skill.formula,
    })),
  })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { skills: { include: { skill: true } }, items: { include: { item: true } } },
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const unlockedIds = new Set(hero.skills.map(s => s.skillId))
  const ownedItemIds = new Set(hero.items.map(hi => hi.itemId))

  function validatePrelimRule(r: any): string | null {
    if (r.skillId && !unlockedIds.has(r.skillId)) return `Skill ID ${r.skillId} en preparación no está desbloqueada`
    if (r.itemId && !ownedItemIds.has(r.itemId)) return `Item ID ${r.itemId} en preparación no lo tenés`
    return null
  }

  function validateAction(action: any, context: string): string | null {
    if (action?.skillId && !unlockedIds.has(action.skillId)) {
      return `Skill ID ${action.skillId} en ${context} no está desbloqueada`
    }
    if (action?.itemId && !ownedItemIds.has(action.itemId)) {
      return `Item ID ${action.itemId} en ${context} no lo tenés`
    }
    return null
  }

  const prelimRules = parsed.data.prelimRules ?? []
  for (const r of prelimRules) {
    const err = validatePrelimRule(r)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }
  const roundRules = parsed.data.roundRules ?? []
  for (const r of roundRules) {
    const err = validateAction(r.action, 'regla de ronda')
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }

  const dl = parsed.data.dungeonLevel ?? null

  const existing = await db.combatProfile.findFirst({
    where: { heroId: hero.id, dungeonLevel: dl }
  })

  const profile = existing
    ? await db.combatProfile.update({
        where: { id: existing.id },
        data: parsed.data,
      })
    : await db.combatProfile.create({
        data: {
          heroId: hero.id,
          name: dl ? `Nivel ${dl}` : "Estándar",
          dungeonLevel: dl,
          position: parsed.data.position ?? 'front',
          initiativeSkill: parsed.data.initiativeSkill ?? 'organization',
          defenseSkills: parsed.data.defenseSkills ?? {},
          prelimRules: parsed.data.prelimRules ?? [],
          roundRules: parsed.data.roundRules ?? [
            { priority: 1, condition: { type: 'hp_self_lt', value: 30 }, action: { skillId: hero.skills[0]?.skill.id ?? 1, targetPos: 'auto', targetType: 'weakest' } },
            { priority: 2, condition: { type: 'always' }, action: { skillId: hero.skills[0]?.skill.id ?? 1, targetPos: 'front', targetType: 'weakest' } },
          ],
        }
      })

  return NextResponse.json(profile)
}
