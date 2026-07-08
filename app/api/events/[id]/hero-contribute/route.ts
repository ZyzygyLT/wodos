import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { id } = await params
  const event = await db.weeklyEvent.findUnique({ where: { id } })
  if (!event) return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  if (!event.isActive) return NextResponse.json({ error: "Evento finalizado" }, { status: 400 })

  const now = new Date()
  if (now < event.startsAt || now > event.endsAt) {
    return NextResponse.json({ error: "Evento fuera de fechas" }, { status: 400 })
  }

  const { amount } = await req.json()
  const increment = amount ?? 1

  const participation = await db.heroEventParticipation.upsert({
    where: { heroId_eventId: { heroId: hero.id, eventId: id } },
    update: { progress: { increment } },
    create: {
      heroId: hero.id,
      eventId: id,
      progress: increment,
      target: getTargetForType(event.type),
    },
  })

  return NextResponse.json({ progress: participation.progress, target: participation.target })
}

function getTargetForType(type: string): number {
  switch (type) {
    case "invasion": return 15
    case "dungeon": return 10
    case "pvp": return 5
    case "crafting": return 8
    case "boss": return 3
    default: return 10
  }
}
