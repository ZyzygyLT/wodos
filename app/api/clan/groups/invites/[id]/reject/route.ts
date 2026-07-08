import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const invite = await db.groupInvite.findUnique({ where: { id } })
  if (!invite) return NextResponse.json({ error: "Invitación no encontrada" }, { status: 404 })
  if (invite.heroId !== hero.id) return NextResponse.json({ error: "No es tu invitación" }, { status: 403 })
  if (invite.status !== "pending") return NextResponse.json({ error: "La invitación ya fue procesada" }, { status: 400 })

  await db.groupInvite.update({
    where: { id },
    data: { status: "rejected" },
  })

  return NextResponse.json({ ok: true })
}
