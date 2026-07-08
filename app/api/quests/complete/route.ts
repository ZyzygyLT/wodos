import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { trackQuestCompleted } from "@/lib/analytics/events"
import { checkLevelUp } from "@/lib/level-up"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { questId } = await req.json()
  if (!questId) return NextResponse.json({ error: "Falta questId" }, { status: 400 })

  const hq = await db.heroQuest.findUnique({
    where: { heroId_questId: { heroId: hero.id, questId } },
    include: { quest: true },
  })
  if (!hq) return NextResponse.json({ error: "Quest no encontrada" }, { status: 404 })
  if (hq.status === "completed") return NextResponse.json({ error: "Ya completada" }, { status: 400 })

  const objectives = hq.quest.objectives as any[]
  const progress = hq.progress as Record<string, number>
  const allDone = objectives.every(obj => (progress[obj.id] || 0) >= (obj.required || 1))
  if (!allDone) return NextResponse.json({ error: "No completaste todos los objetivos" }, { status: 400 })

  const rewards = hq.quest.rewards as any
  await db.$transaction([
    db.heroQuest.update({
      where: { id: hq.id },
      data: { status: "completed", completedAt: new Date() },
    }),
    db.hero.update({
      where: { id: hero.id },
      data: {
        epTotal: { increment: rewards.ep || 0 },
        gold: { increment: rewards.gold || 0 },
        fame: { increment: rewards.fame || 0 },
      },
    }),
  ])

  trackQuestCompleted(session.user.id, { questName: hq.quest.name, questType: hq.quest.type })

  const levelUp = await checkLevelUp(hero.id).catch(() => null)

  if (hq.quest.chainNext) {
    const nextQuest = await db.quest.findUnique({ where: { slug: hq.quest.chainNext } })
    if (nextQuest) {
      const initialProgress: Record<string, number> = {}
      const nextObjs = nextQuest.objectives as any[]
      for (const obj of nextObjs) initialProgress[obj.id] = 0
      await db.heroQuest.upsert({
        where: { heroId_questId: { heroId: hero.id, questId: nextQuest.id } },
        update: {},
        create: { heroId: hero.id, questId: nextQuest.id, progress: initialProgress },
      })
    }
  }

  return NextResponse.json({
    completed: true,
    rewards: { ep: rewards.ep || 0, gold: rewards.gold || 0, fame: rewards.fame || 0 },
    levelUp: levelUp?.leveledUp ? levelUp : undefined,
  })
}
