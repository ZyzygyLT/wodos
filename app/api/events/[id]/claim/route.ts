import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { checkClanLevelUp } from "@/lib/clan/leveling"

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

  if (event.isActive && new Date(event.endsAt) > new Date()) {
    return NextResponse.json({ error: "El evento aún no ha finalizado" }, { status: 400 })
  }

  const clanMember = await db.clanMember.findUnique({
    where: { heroId: hero.id },
    include: { clan: true },
  })
  if (!clanMember) return NextResponse.json({ error: "No pertenecés a ningún clan" }, { status: 400 })
  if (clanMember.role !== "leader") {
    return NextResponse.json({ error: "Solo el líder puede reclamar recompensas" }, { status: 403 })
  }

  const participation = await db.clanEventParticipation.findUnique({
    where: { clanId_eventId: { clanId: clanMember.clanId, eventId: id } },
  })
  if (!participation) {
    return NextResponse.json({ error: "Tu clan no participó en este evento" }, { status: 400 })
  }
  if (participation.claimed) {
    return NextResponse.json({ error: "Ya reclamaste las recompensas de este evento" }, { status: 400 })
  }

  const allParticipations = await db.clanEventParticipation.findMany({
    where: { eventId: id },
    orderBy: { score: "desc" },
  })

  const rank = allParticipations.findIndex(p => p.clanId === clanMember.clanId) + 1
  const total = allParticipations.length
  const rewards = event.rewards as any[] ?? []

  const rewardTier = findEventRewardTier(rewards, rank, total)

  if (!rewardTier) {
    return NextResponse.json({ error: "No hay recompensa disponible para tu posición" }, { status: 400 })
  }

  const fameGained = rewardTier.fame ?? 0

  try {
    await db.$transaction(async tx => {
      const claimed = await tx.clanEventParticipation.updateMany({
        where: { clanId: clanMember.clanId, eventId: id, claimed: false },
        data: { claimed: true },
      })
      if (claimed.count !== 1) throw new Error("CLAN_EVENT_ALREADY_CLAIMED")

      await tx.clan.update({
        where: { id: clanMember.clanId },
        data: {
          fame: { increment: fameGained },
          gold: { increment: rewardTier.gold ?? 0 },
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === "CLAN_EVENT_ALREADY_CLAIMED") {
      return NextResponse.json({ error: "Ya reclamaste las recompensas de este evento" }, { status: 409 })
    }
    throw error
  }

  const newLevel = await checkClanLevelUp(clanMember.clanId)

  return NextResponse.json({
    success: true,
    fame: fameGained,
    gold: rewardTier.gold ?? 0,
    clanLevel: newLevel,
  })
}
