import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { createHero } from "@/lib/hero-utils"
import { trackHeroCreated } from "@/lib/analytics/events"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"
import logger from "@/lib/logger"

const schema = z.object({
  name: z.string().min(2).max(30),
  classId: z.number().int().positive(),
  raceId: z.number().int().positive(),
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 })
    }

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
    }

    const user = await db.user.findUnique({ where: { id: session.user.id } })
    if (!user) {
      return NextResponse.json({ error: "Sesión inválida. Iniciá sesión de nuevo." }, { status: 401 })
    }

    const heroCount = await db.hero.count({ where: { userId: session.user.id } })
    if (user.maxHeroes !== null && heroCount >= user.maxHeroes) {
      return NextResponse.json({ error: `Límite de ${user.maxHeroes} héroes alcanzado` }, { status: 409 })
    }

    const { name, classId, raceId } = parsed.data
    const hero = await createHero(session.user.id, name, classId, raceId)

    const heroClass = await db.class.findUnique({ where: { id: classId }, select: { name: true } })
    const race = await db.race.findUnique({ where: { id: raceId }, select: { name: true } })
    trackHeroCreated(session.user.id, {
      className: heroClass?.name ?? "unknown",
      raceName: race?.name ?? "unknown",
    })

    return NextResponse.json({ id: hero.id, name: hero.name }, { status: 201 })
  } catch (e: any) {
    if (e?.message === "MAX_HEROES_REACHED") {
      return NextResponse.json({ error: "Límite de héroes alcanzado" }, { status: 409 })
    }
    logger.error('hero-create', "Error al crear el héroe", e)
    return NextResponse.json({ error: e.message || "Error al crear el héroe" }, { status: 500 })
  }
}
