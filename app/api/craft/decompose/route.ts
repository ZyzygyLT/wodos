import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { processDecompose } from "@/services/decompose.service"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const { heroItemId } = await req.json()
  if (!heroItemId) return NextResponse.json({ error: "Falta heroItemId" }, { status: 400 })

  const result = await processDecompose(session.user.id, heroItemId)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json(result.data)
}
