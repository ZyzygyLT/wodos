import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { id } = await params
  const factionId = Number.parseInt(id)
  if (Number.isNaN(factionId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const faction = await db.faction.findUnique({
    where: { id: factionId },
    include: { shops: true },
  })
  if (!faction) return NextResponse.json({ error: "Facción no encontrada" }, { status: 404 })

  const heroRep = await db.heroFactionRep.findUnique({
    where: { heroId_factionId: { heroId: hero.id, factionId } },
  })

  const rep = heroRep?.rep ?? 0

  const shops = faction.shops.map(s => ({
    id: s.id,
    name: s.name,
    icon: s.icon,
    minRep: s.minRep,
    unlocked: rep >= s.minRep,
    items: s.items,
  }))

  return NextResponse.json({ faction: { id: faction.id, name: faction.name, icon: faction.icon, color: faction.color }, rep, shops })
}
