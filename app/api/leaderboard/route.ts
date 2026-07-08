import { NextResponse } from "next/server"
import db from "@/lib/db"

const TOP_N = 50

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const sort = searchParams.get("sort") || "fame"

  const orderBy: Record<string, "desc"> = {}
  const validSorts = ["fame", "eloRating", "level", "gold", "arenaWins"]
  const field = validSorts.includes(sort) ? sort : "fame"
  orderBy[field] = "desc"

  const heroes = await db.hero.findMany({
    where: { onboardingDone: true },
    orderBy,
    take: TOP_N,
    select: {
      id: true,
      name: true,
      level: true,
      classId: true,
      class: { select: { name: true, icon: true } },
      raceId: true,
      race: { select: { name: true, icon: true } },
      fame: true,
      eloRating: true,
      gold: true,
      arenaWins: true,
      arenaLosses: true,
      clanMember: { select: { clan: { select: { name: true, tag: true } } } },
    },
  })

  return NextResponse.json({ heroes, sort: field })
}
