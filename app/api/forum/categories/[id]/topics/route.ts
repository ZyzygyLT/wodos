import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { id } = await params

  const category = await db.forumCategory.findUnique({
    where: { id },
    include: { clan: true },
  })
  if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 })

  // Check access
  if (category.clanId) {
    const member = await db.clanMember.findUnique({ where: { heroId: hero.id } })
    if (member?.clanId !== category.clanId) {
      return NextResponse.json({ error: "No tenés acceso a esta categoría" }, { status: 403 })
    }
  }

  const topics = await db.forumTopic.findMany({
    where: { categoryId: category.id },
    orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
    include: {
      author: { select: { name: true, class: { select: { icon: true } } } },
      _count: { select: { replies: true } },
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true, author: { select: { name: true } } },
      },
    },
  })

  const topicsWithLastReply = topics.map(t => ({
    ...t,
    lastReply: t.replies[0] || null,
    replies: undefined,
  }))

  return NextResponse.json({ category, topics: topicsWithLastReply })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { id } = await params

  const category = await db.forumCategory.findUnique({
    where: { id },
    include: { clan: true },
  })
  if (!category) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 })

  if (category.clanId) {
    const member = await db.clanMember.findUnique({ where: { heroId: hero.id } })
    if (member?.clanId !== category.clanId) {
      return NextResponse.json({ error: "No tenés acceso a esta categoría" }, { status: 403 })
    }
  }

  const { title, content } = await req.json()
  if (!title || !content) return NextResponse.json({ error: "Faltan título o contenido" }, { status: 400 })
  if (title.length > 200) return NextResponse.json({ error: "El título no puede superar 200 caracteres" }, { status: 400 })
  if (content.length > 10000) return NextResponse.json({ error: "El contenido no puede superar 10000 caracteres" }, { status: 400 })

  const topic = await db.forumTopic.create({
    data: { categoryId: category.id, authorId: hero.id, title, content },
  })

  return NextResponse.json(topic, { status: 201 })
}
