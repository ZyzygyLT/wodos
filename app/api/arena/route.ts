import { NextResponse } from "next/server"
import db from "@/lib/db"

export async function GET() {
  const heroes = await db.hero.findMany({
    orderBy: { eloRating: "desc" },
    include: {
      class: { select: { name: true, icon: true } },
      user: { select: { name: true } },
    },
  })

  const ranking = heroes.map((h, i) => ({
    rank: i + 1,
    id: h.id,
    name: h.name,
    level: h.level,
    className: (h.class as any)?.name ?? "",
    classIcon: (h.class as any)?.icon ?? "?",
    playerName: (h.user as any)?.name ?? "Unknown",
    elo: h.eloRating,
    wins: h.arenaWins,
    losses: h.arenaLosses,
  }))

  return NextResponse.json(ranking)
}
