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
  try {
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM hero_quests WHERE id = ${hq.id} FOR UPDATE`
      const fresh = await tx.heroQuest.findUnique({
        where: { id: hq.id },
        include: { quest: true },
      })
      if (!fresh || fresh.heroId !== hero.id) throw new Error("QUEST_NOT_FOUND")
      if (fresh.status === "completed") throw new Error("QUEST_ALREADY_COMPLETED")

      const freshObjectives = fresh.quest.objectives as any[]
      const freshProgress = fresh.progress as Record<string, number>
      const objectivesDone = freshObjectives.every(obj => (freshProgress[obj.id] || 0) >= (obj.required || 1))
      if (!objectivesDone) throw new Error("QUEST_OBJECTIVES_INCOMPLETE")

      const completed = await tx.heroQuest.updateMany({
        where: { id: fresh.id, status: fresh.status },
        data: { status: "completed", completedAt: new Date() },
      })
      if (completed.count !== 1) throw new Error("QUEST_ALREADY_COMPLETED")

      await tx.hero.update({
        where: { id: hero.id },
        data: {
          epTotal: { increment: rewards.ep || 0 },
          gold: { increment: rewards.gold || 0 },
          fame: { increment: rewards.fame || 0 },
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === "QUEST_ALREADY_COMPLETED") {
      return NextResponse.json({ error: "Ya completada" }, { status: 409 })
    }
    if (error instanceof Error && error.message === "QUEST_OBJECTIVES_INCOMPLETE") {
      return NextResponse.json({ error: "No completaste todos los objetivos" }, { status: 400 })
    }
    if (error instanceof Error && error.message === "QUEST_NOT_FOUND") {
      return NextResponse.json({ error: "Quest no encontrada" }, { status: 404 })
    }
    throw error
  }

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
