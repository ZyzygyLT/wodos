import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"

const POSITIONS = ['front', 'center', 'rear', 'left_flank', 'right_flank', 'flexible'] as const
const TARGET_POSITIONS = ['front', 'center', 'rear', 'left_flank', 'right_flank', 'auto'] as const
const TARGET_TYPES = ['weakest', 'strongest', 'most_injured_ally', 'random', 'auto', 'self'] as const
const CONDITION_TYPES = [
  'always', 'hp_self_lt', 'hp_self_gt', 'hp_enemy_lt', 'hp_ally_lt',
  'round_gt', 'mana_lt', 'ally_down', 'damaged_this_round',
] as const

const tacticConditionSchema = z.object({
  type: z.enum(CONDITION_TYPES),
  value: z.number().finite().optional(),
}).strict().superRefine((condition, ctx) => {
  if (['hp_self_lt', 'hp_self_gt', 'hp_enemy_lt', 'hp_ally_lt', 'mana_lt'].includes(condition.type)) {
    if (condition.value !== undefined && (condition.value < 0 || condition.value > 100)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'El porcentaje debe estar entre 0 y 100' })
    }
  }
  if (condition.type === 'round_gt' && condition.value !== undefined && condition.value < 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'La ronda debe ser mayor o igual a cero' })
  }
})

const tacticActionSchema = z.object({
  skillId: z.number().int().positive().optional(),
  itemId: z.number().int().positive().optional(),
  targetPos: z.enum(TARGET_POSITIONS),
  targetType: z.enum(TARGET_TYPES),
}).strict().refine(action => (action.skillId !== undefined) !== (action.itemId !== undefined), {
  message: 'Cada acción debe seleccionar exactamente una habilidad o un consumible',
})

const prelimRuleSchema = z.object({
  skillId: z.number().int().positive().optional(),
  itemId: z.number().int().positive().optional(),
}).strict().refine(rule => (rule.skillId !== undefined) !== (rule.itemId !== undefined), {
  message: 'Cada regla de preparación debe seleccionar exactamente una habilidad o un consumible',
})

const roundRuleSchema = z.object({
  priority: z.number().int().positive(),
  condition: tacticConditionSchema,
  action: tacticActionSchema,
}).strict()

const putSchema = z.object({
  dungeonLevel: z.number().int().positive().nullable().optional(),
  position: z.enum(POSITIONS).optional(),
  defenseSkills: z.object({
    melee: z.number().int().positive().nullable().optional(),
    ranged: z.number().int().positive().nullable().optional(),
    magic: z.number().int().positive().nullable().optional(),
  }).strict().optional(),
  prelimRules: z.array(prelimRuleSchema).max(30).optional(),
  roundRules: z.array(roundRuleSchema).max(50).optional(),
}).strict()

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, { include: { skills: { include: { skill: true } } } })
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

  const hero = await getActiveHeroByUserId(session.user.id, { include: { skills: { include: { skill: true } }, items: { include: { item: true } } } })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = putSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const ownedItems = hero.items.map(hi => hi.item)
  const consumableIds = new Set(ownedItems.filter(item => item.category === 'consumable').map(item => item.id))
  const skillsById = new Map(hero.skills.map(entry => [entry.skillId, entry.skill]))

  function validatePrelimRule(r: z.infer<typeof prelimRuleSchema>): string | null {
    if (r.skillId !== undefined) {
      const skill = skillsById.get(r.skillId)
      if (!skill) return `Skill ID ${r.skillId} en preparación no está desbloqueada`
      if (skill.timing !== 'both' && skill.timing !== 'pre_round') return `Skill ID ${r.skillId} no se puede usar durante la preparación`
    }
    if (r.itemId !== undefined && !consumableIds.has(r.itemId)) return `Item ID ${r.itemId} en preparación no es un consumible disponible`
    return null
  }

  function validateAction(action: z.infer<typeof tacticActionSchema>, context: string): string | null {
    if (action.skillId !== undefined) {
      const skill = skillsById.get(action.skillId)
      if (!skill) return `Skill ID ${action.skillId} en ${context} no está desbloqueada`
      if (skill.timing !== 'both' && skill.timing !== 'round') return `Skill ID ${action.skillId} no se puede usar durante una ronda`
    }
    if (action.itemId !== undefined && !consumableIds.has(action.itemId)) {
      return `Item ID ${action.itemId} en ${context} no es un consumible disponible`
    }
    return null
  }

  const prelimRules = parsed.data.prelimRules ?? []
  for (const r of prelimRules) {
    const err = validatePrelimRule(r)
    if (err) return NextResponse.json({ error: err }, { status: 400 })
  }
  const defenseSkills = parsed.data.defenseSkills
  if (defenseSkills) {
    for (const category of ['melee', 'ranged', 'magic'] as const) {
      const skillId = defenseSkills[category]
      if (skillId == null) continue
      const skill = skillsById.get(skillId)
      if (!skill || (skill.defenseCategory !== category && skill.defenseCategory !== 'all')) {
        return NextResponse.json({ error: `Skill ID ${skillId} no es una defensa válida para ${category}` }, { status: 400 })
      }
    }
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
