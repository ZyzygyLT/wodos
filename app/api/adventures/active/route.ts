import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import * as adventureService from "@/services/adventure.service"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })
  if (!hero) return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })

  try {
    const active = await adventureService.getActiveAdventure(hero.id)
    return NextResponse.json(active ?? { active: false })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
