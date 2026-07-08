import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST(_req: Request, { params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { clanMember: true },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  if (!hero.clanMember) return NextResponse.json({ error: "No pertenecés a un clan" }, { status: 400 })

  const group = await db.clanGroup.findUnique({ where: { id: groupId } })
  if (!group) return NextResponse.json({ error: "Grupo no encontrado" }, { status: 404 })
  if (group.clanId !== hero.clanMember.clanId) return NextResponse.json({ error: "No es tu clan" }, { status: 403 })

  if (hero.clanMember.groupId !== group.id) return NextResponse.json({ error: "No estás en este grupo" }, { status: 400 })

  if (group.leaderId === hero.id) return NextResponse.json({ error: "El líder no puede irse. Transferí el liderazgo primero." }, { status: 400 })

  await db.clanMember.update({
    where: { heroId: hero.id },
    data: { groupId: null, groupRole: null },
  })

  return NextResponse.json({ success: true })
}
