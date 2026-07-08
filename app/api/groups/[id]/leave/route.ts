import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const member = await db.groupMember.findUnique({
    where: { groupId_heroId: { groupId: id, heroId: hero.id } },
  })
  if (!member) return NextResponse.json({ error: "No estás en este grupo" }, { status: 400 })

  if (member.role === "leader") {
    return NextResponse.json({ error: "El líder no puede irse. Transferí el liderazgo primero." }, { status: 400 })
  }

  await db.groupMember.delete({ where: { id: member.id } })
  return NextResponse.json({ success: true })
}
