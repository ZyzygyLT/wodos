import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

function findEventRewardTier(rewards: any[], rank: number, total: number) {
  for (const r of rewards) {
    if (r.rank === "1" && rank === 1) return r
    if (r.rank === "2-3" && (rank === 2 || rank === 3)) return r
    if (r.rank === "top10pct" && rank <= Math.ceil(total * 0.1)) return r
    if (r.rank === "participant") return r
  }
  return null
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { id } = await params
  const event = await db.weeklyEvent.findUnique({ where: { id } })
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })

  const participation = await db.heroEventParticipation.findUnique({
    where: { heroId_eventId: { heroId: hero.id, eventId: id } },
  })
  if (!participation) return NextResponse.json({ error: "No participaste en este evento" }, { status: 400 })
  if (!participation.completed) return NextResponse.json({ error: "Aún no completaste el objetivo" }, { status: 400 })
  if (participation.claimedAt) return NextResponse.json({ error: "Ya reclamaste la recompensa" }, { status: 400 })

  const rewards = event.rewards as any[]
  const totalHeroes = await db.heroEventParticipation.count({ where: { eventId: id } })
  const myRank = await db.heroEventParticipation.count({
    where: { eventId: id, progress: { gt: participation.progress } },
  }) + 1

  const rewardTier = findEventRewardTier(rewards, myRank, totalHeroes)

  if (!rewardTier) return NextResponse.json({ error: "No hay recompensa para tu posición" }, { status: 400 })

  const fameGained = rewardTier.fame ?? 0
  const goldGained = rewardTier.gold ?? 0

  await db.$transaction([
    db.hero.update({
      where: { id: hero.id },
      data: {
        fame: { increment: fameGained },
        gold: { increment: goldGained },
      },
    }),
    db.heroEventParticipation.update({
      where: { heroId_eventId: { heroId: hero.id, eventId: id } },
      data: { claimedAt: new Date() },
    }),
  ])

  return NextResponse.json({ fame: fameGained, gold: goldGained, rank: myRank })
}
