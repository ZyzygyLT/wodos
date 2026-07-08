import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { checkRateLimit, ipKey } from "@/lib/rate-limit"
import { processInstantDungeon, registerScheduledDungeon } from "@/services/dungeon-registration.service"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"

const schema = z.object({
  dungeonId: z.number().int().positive(),
  profileId: z.string().optional(),
  groupId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`dungeon:${ipKey(req)}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: "Demasiadas peticiones. Intentá de nuevo en un minuto." }, { status: 429 })
  }

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

  const dungeon = await db.dungeon.findUnique({ where: { id: parsed.data.dungeonId } })
  if (!dungeon) return NextResponse.json({ error: "Mazmorra no encontrada" }, { status: 404 })

  const params = {
    heroId: hero.id,
    dungeonId: parsed.data.dungeonId,
    profileId: parsed.data.profileId ?? null,
    groupId: parsed.data.groupId ?? null,
  }

  if (dungeon.isInstant) {
    const result = await processInstantDungeon(params)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 })
    }
    return NextResponse.json({ instant: true, ...result.data })
  }

  const result = await registerScheduledDungeon(params)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 400 })
  }
  return NextResponse.json(result.data, { status: 201 })
}
