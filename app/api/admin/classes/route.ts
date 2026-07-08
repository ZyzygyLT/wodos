import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/require-admin"
import db from "@/lib/db"

export async function GET() {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const classes = await db.class.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { id: "asc" },
  })
  return NextResponse.json(classes)
}
