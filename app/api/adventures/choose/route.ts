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

  const { heroAdventureId, choiceIndex } = await req.json()
  if (!heroAdventureId || choiceIndex === undefined) {
    return NextResponse.json({ error: "Faltan parámetros" }, { status: 400 })
  }

  try {
    const result = await adventureService.makeChoice(hero.id, heroAdventureId, choiceIndex)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
