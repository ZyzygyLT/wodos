import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { id } = await params
  const reply = await db.forumReply.findUnique({ where: { id } })
  if (!reply) return NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 })

  if (reply.authorId !== hero.id) {
    return NextResponse.json({ error: "No tenés permisos para editar esta respuesta" }, { status: 403 })
  }

  const { content } = await req.json()
  if (!content?.trim()) return NextResponse.json({ error: "Falta contenido" }, { status: 400 })

  const updated = await db.forumReply.update({
    where: { id },
    data: { content: content.trim() },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { id } = await params
  const reply = await db.forumReply.findUnique({
    where: { id },
    include: { topic: { include: { category: { include: { clan: { include: { members: true } } } } } } },
  })
  if (!reply) return NextResponse.json({ error: "Respuesta no encontrada" }, { status: 404 })

  const isAuthor = reply.authorId === hero.id
  const isTopicAuthor = reply.topic.authorId === hero.id
  const isClanMod = reply.topic.category.clan?.members.some(m => m.heroId === hero.id && (m.role === "leader" || m.role === "officer"))

  if (!isAuthor && !isTopicAuthor && !isClanMod) {
    return NextResponse.json({ error: "No tenés permisos para borrar esta respuesta" }, { status: 403 })
  }

  await db.forumReply.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
