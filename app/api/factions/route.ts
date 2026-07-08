import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getHeroFactionReps } from "@/services/faction.service"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const factions = await getHeroFactionReps(hero.id)
  return NextResponse.json(factions)
}
