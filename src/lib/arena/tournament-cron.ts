import db from "@/lib/db"
import { createWeeklyTournament } from "./tournament"
import { advanceTournament } from "@/services/tournament.service"

const ROUND_INTERVAL_MS = 2 * 60 * 60 * 1000 // 2 hours between rounds

async function handleRegistrationPhase(active: any) {
  const elapsed = Date.now() - new Date(active.startsAt).getTime()
  if (elapsed <= 24 * 60 * 60 * 1000 && active._count?.participants < active.maxPlayers) return
  const participants = await db.tournamentParticipant.count({ where: { tournamentId: active.id } })
  if (participants >= 2) {
    console.log(`[tournament-cron] Cerrando registro y generando bracket (${participants} participantes)`)
    await advanceTournament()
  } else {
    console.log(`[tournament-cron] Solo ${participants} participantes, extendiendo registro`)
  }
}

async function handleActivePhase(active: any) {
  const lastMatch = active.matches[0]
  const lastPlayed = lastMatch?.playedAt ? new Date(lastMatch.playedAt).getTime() : new Date(active.startsAt).getTime()
  const elapsed = Date.now() - lastPlayed
  if (elapsed < ROUND_INTERVAL_MS) return
  const pending = await db.tournamentMatch.count({
    where: { tournamentId: active.id, winnerId: null },
  })
  if (pending <= 0) return
  console.log(`[tournament-cron] Avanzando ronda del torneo (${pending} matches pendientes)`)
  await advanceTournament()
}

export async function tickTournament() {
  const active = await db.tournament.findFirst({
    where: { status: { in: ["registration", "active"] } },
    include: { matches: { orderBy: { round: "desc" }, take: 1 }, _count: { select: { participants: true } } },
    orderBy: { startsAt: "desc" },
  })

  if (!active) {
    const lastCompleted = await db.tournament.findFirst({
      where: { status: "completed" },
      orderBy: { endsAt: "desc" },
    })

    // Create new tournament if none exists and last one ended > 7 days ago
    if (!lastCompleted || Date.now() - new Date(lastCompleted.endsAt).getTime() > 7 * 24 * 60 * 60 * 1000) {
      console.log("[tournament-cron] Creando nuevo torneo semanal")
      await createWeeklyTournament()
    }
    return
  }

  if (active.status === "registration") {
    await handleRegistrationPhase(active)
    return
  }

  if (active.status === "active") {
    await handleActivePhase(active)
  }
}
