import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/require-admin"
import db from "@/lib/db"

export async function GET() {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const dungeons = await db.dungeon.findMany({ orderBy: { id: "asc" } })
  return NextResponse.json(dungeons)
}

export async function POST(req: NextRequest) {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const data = await req.json()
  const dungeon = await db.dungeon.create({ data })
  return NextResponse.json(dungeon, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const { id, ...data } = await req.json()
  const dungeon = await db.dungeon.update({ where: { id }, data })
  return NextResponse.json(dungeon)
}

export async function DELETE(req: NextRequest) {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 })
  await db.dungeon.delete({ where: { id: Number.parseInt(id) } })
  return NextResponse.json({ success: true })
}
