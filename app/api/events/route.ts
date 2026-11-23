import { NextResponse } from "next/server"
import db from "@/lib/db"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const includePast = url.searchParams.get("past") === "true"
  const now = new Date()

  if (includePast) {
    const pastEvents = await db.weeklyEvent.findMany({
      where: { isActive: false, endsAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } },
      orderBy: { endsAt: "desc" },
      include: {
        participations: {
          include: { clan: { select: { id: true, name: true, tag: true, icon: true } } },
          orderBy: { score: "desc" },
        },
      },
    })
    return NextResponse.json(pastEvents)
  }

  const activeEvents = await db.weeklyEvent.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    include: {
      participations: {
        include: { clan: { select: { id: true, name: true, tag: true, icon: true } } },
        orderBy: { score: "desc" },
        take: 10,
      },
    },
  })

  return NextResponse.json(activeEvents)
}
