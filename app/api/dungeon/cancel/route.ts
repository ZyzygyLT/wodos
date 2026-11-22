import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const activeRun = await db.dungeonRun.findFirst({
    where: {
      status: 'registered',
      OR: [
        { heroId: hero.id },
        { participants: { some: { heroId: hero.id } } },
        ...(hero.dungeonRegisteredId ? [{ id: hero.dungeonRegisteredId }] : []),
      ],
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      heroId: true,
      participants: { select: { heroId: true } },
    },
  })

  if (!activeRun) {
    return NextResponse.json({ error: "No estás registrado en ninguna expedición pendiente" }, { status: 400 })
  }

  const cancelled = await db.$transaction(async tx => {
    const result = await tx.dungeonRun.updateMany({
      where: { id: activeRun.id, status: 'registered' },
      data: { status: 'failed', result: 'defeat', completesAt: new Date() },
    })
    if (result.count !== 1) return false

    const participantIds = [...new Set([
      activeRun.heroId,
      ...activeRun.participants.map(participant => participant.heroId),
    ])]
    await tx.hero.updateMany({
      where: { id: { in: participantIds }, dungeonRegisteredId: activeRun.id },
      data: { dungeonRegisteredId: null },
    })
    return true
  })

  if (!cancelled) {
    return NextResponse.json({ error: "La expedición ya comenzó o fue cancelada" }, { status: 409 })
  }

  return NextResponse.json({ cancelled: true, runId: activeRun.id })
}
