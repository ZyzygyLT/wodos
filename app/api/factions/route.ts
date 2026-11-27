import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { getHeroFactionReps } from "@/services/faction.service"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const factions = await getHeroFactionReps(hero.id)
  return NextResponse.json(factions)
}
