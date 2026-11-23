import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { setActiveHeroForUser } from "@/lib/hero-utils"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const { id } = await params
  const changed = await setActiveHeroForUser(session.user.id, id)
  if (!changed) {
    return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  }

  return NextResponse.json({ success: true, currentHeroId: id })
}
