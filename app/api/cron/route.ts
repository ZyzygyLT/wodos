import { NextRequest, NextResponse } from "next/server"
import { tick, resetDailyQuests } from "@/lib/dungeon-cron"
import { tickTournament } from "@/lib/arena/tournament-cron"
import { tickEvents } from "@/lib/events/events-cron"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || secret.length < 32) {
    return NextResponse.json({ error: "CRON_SECRET not configured on server" }, { status: 503 })
  }

  const header = req.headers.get("x-cron-secret")
  if (header !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const start = Date.now()
  const results: Record<string, unknown> = {}

  results.dungeon = await tick().then(() => ({ ok: true })).catch(e => ({ ok: false, error: String(e) }))
  results.quests = await resetDailyQuests()
  results.tournament = await tickTournament().then(() => ({ ok: true })).catch(e => ({ ok: false, error: String(e) }))
  results.events = await tickEvents().then(() => ({ ok: true })).catch(e => ({ ok: false, error: String(e) }))

  const elapsed = Date.now() - start

  return NextResponse.json({ ok: true, elapsed: `${elapsed}ms`, results })
}
