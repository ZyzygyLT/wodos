import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import * as adventureService from "@/services/adventure.service"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!hero) return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })

  const { heroAdventureId } = await req.json()
  if (!heroAdventureId) return NextResponse.json({ error: "Falta heroAdventureId" }, { status: 400 })

  try {
    const result = await adventureService.abandonAdventure(hero.id, heroAdventureId)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
