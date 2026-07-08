import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/require-admin"
import db from "@/lib/db"

export async function GET() {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const quests = await db.quest.findMany({ orderBy: { createdAt: "desc" } })
  return NextResponse.json(quests)
}

export async function POST(req: NextRequest) {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const data = await req.json()
  const quest = await db.quest.create({ data })
  return NextResponse.json(quest, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const { id, ...data } = await req.json()
  const quest = await db.quest.update({ where: { id }, data })
  return NextResponse.json(quest)
}

export async function DELETE(req: NextRequest) {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 })
  await db.quest.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
