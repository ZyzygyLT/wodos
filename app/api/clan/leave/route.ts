import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id, { include: { clanMember: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (!hero.clanMember) return NextResponse.json({ error: "No pertenecés a un clan" }, { status: 400 })
  if (hero.clanMember.role === "leader") return NextResponse.json({ error: "El líder no puede irse. Transferí el liderazgo primero" }, { status: 400 })

  await db.clanMember.delete({ where: { heroId: hero.id } })

  return NextResponse.json({ success: true })
}
