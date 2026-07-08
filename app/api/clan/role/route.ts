import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

const VALID_ROLES = ["officer", "member"] as const

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { clanMember: true },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (!hero.clanMember) return NextResponse.json({ error: "No pertenecés a un clan" }, { status: 400 })
  if (hero.clanMember.role !== "leader") return NextResponse.json({ error: "Solo el líder puede cambiar roles" }, { status: 403 })

  const { heroId, role } = await req.json()
  if (!heroId || !role) return NextResponse.json({ error: "Faltan heroId o role" }, { status: 400 })
  if (!VALID_ROLES.includes(role)) return NextResponse.json({ error: "Rol inválido. Usá officer o member" }, { status: 400 })
  if (heroId === hero.id) return NextResponse.json({ error: "No podés cambiar tu propio rol" }, { status: 400 })

  const target = await db.clanMember.findUnique({ where: { heroId } })
  if (target?.clanId !== hero.clanMember.clanId) return NextResponse.json({ error: "No está en tu clan" }, { status: 404 })
  if (target.role === "leader") return NextResponse.json({ error: "No podés cambiar el rol del líder" }, { status: 403 })

  await db.clanMember.update({ where: { heroId }, data: { role } })

  return NextResponse.json({ success: true, newRole: role })
}
