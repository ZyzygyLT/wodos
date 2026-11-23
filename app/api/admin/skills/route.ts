import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/admin/require-admin"
import db from "@/lib/db"

const skillIncludes = { class: { select: { id: true, name: true, slug: true } } }

export async function GET() {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const skills = await db.skill.findMany({
    include: skillIncludes,
    orderBy: { id: "asc" },
  })
  return NextResponse.json(skills)
}

export async function POST(req: NextRequest) {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const data = await req.json()
  const skill = await db.skill.create({ data, include: skillIncludes })
  return NextResponse.json(skill, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const { id, ...data } = await req.json()
  const skill = await db.skill.update({ where: { id }, data, include: skillIncludes })
  return NextResponse.json(skill)
}

export async function DELETE(req: NextRequest) {
  const r = await requireAdmin()
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 })
  await db.skill.delete({ where: { id: Number.parseInt(id) } })
  return NextResponse.json({ success: true })
}
