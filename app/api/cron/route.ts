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
  if (!secret || !header) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const a = Buffer.from(header)
  const b = Buffer.from(secret)
  if (a.length !== b.length || !require("crypto").timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (process.env.ENABLE_BACKGROUND_WORKERS === "true") {
    return NextResponse.json({ ok: true, skipped: "in-process cron active" })
  }

  const start = Date.now()
  const results: Record<string, unknown> = {}

  results.dungeon = await tick().then(() => ({ ok: true })).catch(e => ({ ok: false, error: String(e) }))
  results.quests = await resetDailyQuests()
  results.tournament = await tickTournament().then(() => ({ ok: true })).catch(e => ({ ok: false, error: String(e) }))
  results.events = await tickEvents().then(() => ({ ok: true })).catch(e => ({ ok: false, error: String(e) }))

  const elapsed = Date.now() - start
  const hasFailure = Object.values(results).some(result =>
    typeof result === "object" &&
    result !== null &&
    (("ok" in result && result.ok === false) || "error" in result),
  )

  return NextResponse.json(
    { ok: !hasFailure, elapsed: `${elapsed}ms`, results },
    { status: hasFailure ? 500 : 200 },
  )
}
