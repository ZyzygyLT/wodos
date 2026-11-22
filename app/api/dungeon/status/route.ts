import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const lastRun = await db.dungeonRun.findFirst({
    where: {
      OR: [
        { heroId: hero.id },
        { participants: { some: { heroId: hero.id } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: { dungeon: true },
  })

  if (!lastRun) {
    return NextResponse.json({ status: 'idle' })
  }

  if (lastRun.status === 'registered') {
    const times = lastRun.dungeon.scheduledTimes as string[]
    const nextTime = getNextScheduledTime(times)
    return NextResponse.json({
      status: 'registered',
      dungeon: lastRun.dungeon.name,
      dungeonId: lastRun.dungeon.id,
      runId: lastRun.id,
      nextRunAt: nextTime?.toISOString() ?? null,
    })
  }

  if (lastRun.status === 'running') {
    return NextResponse.json({
      status: 'running',
      dungeon: lastRun.dungeon.name,
    })
  }

  return NextResponse.json({
    status: lastRun.status,
    runId: lastRun.id,
    result: lastRun.result,
    dungeon: lastRun.dungeon.name,
    levelsCleared: lastRun.levelsCleared,
    epGained: lastRun.epGained,
    goldGained: lastRun.goldGained,
    loot: lastRun.loot,
  })
}

function getNextScheduledTime(times: string[]): Date | null {
  if (!times || times.length === 0) return null
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  for (const t of times) {
    const dt = new Date(`${todayStr}T${t}:00Z`)
    if (dt > now) return dt
  }

  const first = [...times].sort((a, b) => a.localeCompare(b))[0]
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)
  return new Date(`${tomorrowStr}T${first}:00Z`)
}
