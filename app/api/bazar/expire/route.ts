import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { tickBazarAuctions } from "@/lib/bazar-cron"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  // Use the same locked, cycle-aware, idempotent settlement path as the worker.
  await tickBazarAuctions()
  return NextResponse.json({ success: true, message: "Se procesaron las publicaciones vencidas." })
}
