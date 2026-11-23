import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id, { include: { clanMember: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (!hero.clanMember) return NextResponse.json({ error: "No pertenecés a un clan" }, { status: 400 })
  if (hero.clanMember.role === "member") return NextResponse.json({ error: "Solo líderes y oficiales pueden expulsar" }, { status: 403 })

  const { heroId } = await req.json()
  if (!heroId) return NextResponse.json({ error: "Falta heroId" }, { status: 400 })
  if (heroId === hero.id) return NextResponse.json({ error: "No podés expulsarte a vos mismo" }, { status: 400 })

  const target = await db.clanMember.findUnique({
    where: { heroId },
    include: { hero: true },
  })
  if (target?.clanId !== hero.clanMember.clanId) return NextResponse.json({ error: "No está en tu clan" }, { status: 404 })
  if (target.role === "leader") return NextResponse.json({ error: "No podés expulsar al líder" }, { status: 403 })

  await db.clanMember.delete({ where: { heroId } })

  return NextResponse.json({ success: true, kicked: target.hero.name })
}
