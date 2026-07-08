import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { processReroll } from "@/services/reroll.service"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const { heroItemId, statKey } = await req.json()
  if (!heroItemId || !statKey) {
    return NextResponse.json({ error: "Faltan heroItemId o statKey" }, { status: 400 })
  }

  const result = await processReroll(session.user.id, heroItemId, statKey)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json(result.data)
}
