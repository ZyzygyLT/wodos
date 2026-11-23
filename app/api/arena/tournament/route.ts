import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET() {
  const tournament = await db.tournament.findFirst({
    where: { status: { in: ["registration", "active"] } },
    include: {
      participants: {
        include: { hero: { include: { class: true } } },
        orderBy: { seed: "asc" },
      },
      matches: { orderBy: [{ round: "asc" }, { matchNumber: "asc" }] },
    },
  })

  return NextResponse.json(tournament)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const tournament = await db.tournament.findFirst({
    where: { status: "registration" },
    include: { _count: { select: { participants: true } } },
  })
  if (!tournament) return NextResponse.json({ error: "No hay torneo abierto" }, { status: 404 })
  if (tournament._count.participants >= tournament.maxPlayers) {
    return NextResponse.json({ error: "El torneo está lleno" }, { status: 400 })
  }

  const existing = await db.tournamentParticipant.findUnique({
    where: { tournamentId_heroId: { tournamentId: tournament.id, heroId: hero.id } },
  })
  if (existing) return NextResponse.json({ error: "Ya estás inscripto" }, { status: 400 })

  const participant = await db.tournamentParticipant.create({
    data: { tournamentId: tournament.id, heroId: hero.id, seed: 0 },
  })

  return NextResponse.json(participant, { status: 201 })
}
