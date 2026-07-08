import { NextResponse } from "next/server"
import { runArenaDuel } from "@/lib/combat-engine/arena-runner"
import { auth } from "@/auth"
import { updateQuestProgress } from "@/lib/quests/progress"
import { checkAchievements } from "@/lib/achievements/checker"
import { trackDuelCompleted } from "@/lib/analytics/events"
import { trackHeroEventProgress } from "@/services/event.service"
import { adjustRep } from "@/services/faction.service"
import db from "@/lib/db"

const DUEL_COOLDOWN_MS = 5 * 60 * 1000

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { hero2Id } = await req.json()
  if (!hero2Id) {
    return NextResponse.json({ error: "Falta hero2Id" }, { status: 400 })
  }

  if (hero2Id === hero.id) {
    return NextResponse.json({ error: "No puedes duelarte a ti mismo" }, { status: 400 })
  }

  const lastDuel = await db.duelHistory.findFirst({
    where: {
      OR: [{ hero1Id: hero.id }, { hero2Id: hero.id }],
    },
    orderBy: { foughtAt: "desc" },
    select: { foughtAt: true },
  })

  if (lastDuel) {
    const elapsed = Date.now() - lastDuel.foughtAt.getTime()
    if (elapsed < DUEL_COOLDOWN_MS) {
      const remaining = Math.ceil((DUEL_COOLDOWN_MS - elapsed) / 1000)
      return NextResponse.json({ error: `Cooldown: esperá ${remaining}s para el próximo duelo` }, { status: 429 })
    }
  }

  try {
    const result = await runArenaDuel(hero.id, hero2Id)

    if (result.won) {
      updateQuestProgress(hero.id, { type: "arena_wins" }).catch(() => {})
      checkAchievements(hero.id, { type: "arena_wins" }).catch(() => {})
      trackHeroEventProgress(hero.id, "pvp", 1).catch(() => {})
      adjustRep(hero.id, 1, 3).catch(() => {}) // Guardia +3
      adjustRep(hero.id, 6, 2).catch(() => {}) // Sombra +2
    }

    trackDuelCompleted(session.user.id, {
      won: result.won,
      eloChange: result.eloChange,
      opponentLevel: result.opponentLevel ?? 0,
    })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
