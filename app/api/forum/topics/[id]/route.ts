import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { id } = await params
  const topic = await db.forumTopic.findUnique({
    where: { id },
    include: { category: { include: { clan: { include: { members: true } } } } },
  })
  if (!topic) return NextResponse.json({ error: "Topic no encontrado" }, { status: 404 })

  const isAuthor = topic.authorId === hero.id
  const isClanMod = topic.category.clan?.members.some(m => m.heroId === hero.id && (m.role === "leader" || m.role === "officer"))

  if (!isAuthor && !isClanMod) return NextResponse.json({ error: "No tenés permisos para modificar este topic" }, { status: 403 })

  const { isPinned, isLocked, title, content } = await req.json()
  if (isPinned !== undefined && !isClanMod) return NextResponse.json({ error: "Solo oficiales/líder del clan pueden pinner" }, { status: 403 })

  const data: any = {}
  if (isPinned !== undefined) data.isPinned = isPinned
  if (isLocked !== undefined) data.isLocked = isLocked
  if (title !== undefined && isAuthor) data.title = title.trim()
  if (content !== undefined && isAuthor) data.content = content.trim()

  const updated = await db.forumTopic.update({
    where: { id },
    data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { id } = await params
  const topic = await db.forumTopic.findUnique({
    where: { id },
    include: { category: { include: { clan: { include: { members: true } } } } },
  })
  if (!topic) return NextResponse.json({ error: "Topic no encontrado" }, { status: 404 })

  const isAuthor = topic.authorId === hero.id
  const isClanMod = topic.category.clan?.members.some(m => m.heroId === hero.id && (m.role === "leader" || m.role === "officer"))

  if (!isAuthor && !isClanMod) return NextResponse.json({ error: "No tenés permisos para borrar este topic" }, { status: 403 })

  await db.forumTopic.delete({ where: { id } })

  return NextResponse.json({ success: true })
}
