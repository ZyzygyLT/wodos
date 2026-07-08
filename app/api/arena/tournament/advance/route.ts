import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { advanceTournament } from "@/services/tournament.service"
import db from "@/lib/db"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { isAdmin: true } })
  if (!user?.isAdmin) return NextResponse.json({ error: "Solo administradores pueden avanzar torneos" }, { status: 403 })

  const result = await advanceTournament()
  if (result.error) {
    const status = result.status === "none" ? 404 : 400
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json(result)
}
