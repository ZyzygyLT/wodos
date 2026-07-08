import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
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

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
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

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const profile = await db.combatProfile.create({
    data: {
      heroId: hero.id,
      name: parsed.data.name,
      position: parsed.data.position,
      initiativeSkill: "organization",
      roundRules: [
        {
          priority: 1,
          condition: { type: "hp_self_lt", value: 30 },
          action: { skillId: 1, targetPos: "auto", targetType: "most_injured_ally" }
        },
        {
          priority: 2,
          condition: { type: "always" },
          action: { skillId: 1, targetPos: "front", targetType: "weakest" }
        }
      ],
    }
  })

  return NextResponse.json(profile, { status: 201 })
}
