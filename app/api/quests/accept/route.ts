import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const { questSlug } = await req.json()
  if (!questSlug) return NextResponse.json({ error: "Falta questSlug" }, { status: 400 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { heroQuests: true },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const quest = await db.quest.findUnique({ where: { slug: questSlug } })
  if (!quest) return NextResponse.json({ error: "Quest no encontrada" }, { status: 404 })
  if (hero.level < quest.levelReq) {
    return NextResponse.json({ error: `Requiere nivel ${quest.levelReq}` }, { status: 400 })
  }

  const existing = hero.heroQuests.find(hq => hq.questId === quest.id)
  if (existing) return NextResponse.json({ error: "Quest ya activa o completada" }, { status: 400 })

  const objectives = quest.objectives as any[]
  const initialProgress: Record<string, number> = {}
  for (const obj of objectives) {
    initialProgress[obj.id] = 0
  }

  const heroQuest = await db.heroQuest.create({
    data: { heroId: hero.id, questId: quest.id, progress: initialProgress },
  })

  return NextResponse.json(heroQuest, { status: 201 })
}
