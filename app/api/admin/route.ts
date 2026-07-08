import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/require-admin"

export async function GET() {
  const result = await requireAdmin()
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ admin: true })
}
