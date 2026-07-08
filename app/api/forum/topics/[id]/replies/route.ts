import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { notify } from "@/lib/notifications/emitter"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { id } = await params

  const topic = await db.forumTopic.findUnique({
    where: { id },
    include: {
      category: { include: { clan: true } },
      author: { select: { name: true, class: { select: { icon: true, name: true } }, level: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        include: { author: { select: { name: true, class: { select: { icon: true } }, level: true } } },
      },
    },
  })
  if (!topic) return NextResponse.json({ error: "Topic no encontrado" }, { status: 404 })

  if (topic.category.clanId) {
    const member = await db.clanMember.findUnique({ where: { heroId: hero.id } })
    if (member?.clanId !== topic.category.clanId) {
      return NextResponse.json({ error: "No tenés acceso" }, { status: 403 })
    }
  }

  return NextResponse.json({ topic, replies: topic.replies })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { id } = await params

  const topic = await db.forumTopic.findUnique({
    where: { id },
    include: { category: { include: { clan: true } } },
  })
  if (!topic) return NextResponse.json({ error: "Topic no encontrado" }, { status: 404 })

  if (topic.category.clanId) {
    const member = await db.clanMember.findUnique({ where: { heroId: hero.id } })
    if (member?.clanId !== topic.category.clanId) {
      return NextResponse.json({ error: "No tenés acceso" }, { status: 403 })
    }
  }

  if (topic.isLocked) return NextResponse.json({ error: "El topic está cerrado" }, { status: 400 })

  const { content } = await req.json()
  if (!content) return NextResponse.json({ error: "Falta contenido" }, { status: 400 })
  if (content.length > 5000) return NextResponse.json({ error: "La respuesta no puede superar 5000 caracteres" }, { status: 400 })

  const reply = await db.forumReply.create({
    data: { topicId: topic.id, authorId: hero.id, content },
  })

  if (topic.authorId !== hero.id) {
    await notify({
      heroId: topic.authorId,
      type: "system",
      title: "Nueva respuesta en tu topic",
      body: `${hero.name} respondió en "${topic.title}"`,
      data: { url: `/forum/topic/${topic.id}` },
    })
  }

  return NextResponse.json(reply, { status: 201 })
}
