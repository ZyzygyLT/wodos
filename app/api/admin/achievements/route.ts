import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/require-admin"
import db from "@/lib/db"

export async function GET() {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const achievements = await db.achievement.findMany({ orderBy: { order: "asc" } })
  return NextResponse.json(achievements)
}

export async function POST(req: NextRequest) {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const data = await req.json()
  const achievement = await db.achievement.create({ data })
  return NextResponse.json(achievement, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const { id, ...data } = await req.json()
  const achievement = await db.achievement.update({ where: { id }, data })
  return NextResponse.json(achievement)
}

export async function DELETE(req: NextRequest) {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 })
  await db.achievement.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
