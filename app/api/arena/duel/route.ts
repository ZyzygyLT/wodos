import { NextResponse } from "next/server"
import { runArenaDuel } from "@/lib/combat-engine/arena-runner"
import { auth } from "@/auth"
import { updateQuestProgress } from "@/lib/quests/progress"
import { checkAchievements } from "@/lib/achievements/checker"
import logger from "@/lib/logger"
import { trackDuelCompleted } from "@/lib/analytics/events"
import { trackHeroEventProgress } from "@/services/event.service"
import { adjustRep } from "@/services/faction.service"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { hero2Id } = await req.json()
  if (!hero2Id) {
    return NextResponse.json({ error: "Falta hero2Id" }, { status: 400 })
  }

  if (hero2Id === hero.id) {
    return NextResponse.json({ error: "No puedes duelarte a ti mismo" }, { status: 400 })
  }


  try {
    const result = await runArenaDuel(hero.id, hero2Id)

    if (result.won) {
      updateQuestProgress(hero.id, { type: "arena_wins" }).catch(e => logger.error("api", "Background operation failed", e))
      checkAchievements(hero.id, { type: "arena_wins" }).catch(e => logger.error("api", "Background operation failed", e))
      trackHeroEventProgress(hero.id, "pvp", 1).catch(e => logger.error("api", "Background operation failed", e))
      adjustRep(hero.id, 1, 3).catch(e => logger.error("api", "Background operation failed", e)) // Guardia +3
      adjustRep(hero.id, 6, 2).catch(e => logger.error("api", "Background operation failed", e)) // Sombra +2
    }

    trackDuelCompleted(session.user.id, {
      won: result.won,
      eloChange: result.eloChange,
      opponentLevel: result.opponentLevel ?? 0,
    })
    return NextResponse.json(result)
  } catch (e: any) {
    if (typeof e?.message === "string" && e.message.startsWith("DUEL_COOLDOWN:")) {
      const remaining = e.message.split(":")[1]
      return NextResponse.json({ error: `Cooldown: esperá ${remaining}s para el próximo duelo` }, { status: 429 })
    }
    if (e?.message === "No puedes duelarte a ti mismo") {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    if (e?.message === "Héroe no encontrado") {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    if (typeof e?.message === "string" && e.message.startsWith("Oro insuficiente")) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
