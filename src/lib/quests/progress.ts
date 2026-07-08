import db from "@/lib/db"
import { trackQuestCompleted } from "@/lib/analytics/events"
import { checkLevelUp } from "@/lib/level-up"
import { notify } from "@/lib/notifications/emitter"
import { adjustRep } from "@/services/faction.service"

export async function updateQuestProgress(heroId: string, event: {
  type: "dungeon_complete" | "total_kills" | "ep_total" | "level" | "arena_wins" | "skills_unlocked" | "skills_upgraded" | "enchant_item" | "socket_rune" | "craft_items" | "login"
  dungeonSlug?: string
  kills?: number
  value?: number
}) {
  const heroQuests = await db.heroQuest.findMany({
    where: { heroId, status: "active" },
    include: { quest: true },
  })

  for (const hq of heroQuests) {
    const objectives = hq.quest.objectives as any[]
    const progress = hq.progress as Record<string, number>
    let updated = false

    for (const obj of objectives) {
      if (obj.type !== event.type) continue
      if (obj.type === "dungeon_complete" && obj.dungeonSlug && event.dungeonSlug && obj.dungeonSlug !== event.dungeonSlug) continue

      const current = progress[obj.id] || 0
      const increment = event.kills || event.value || 1
      progress[obj.id] = Math.min(current + increment, obj.required)
      updated = true
    }

    if (!updated) continue

    const allDone = objectives.every(obj => (progress[obj.id] || 0) >= obj.required)

    if (allDone) {
      await handleQuestCompletion(heroId, hq, progress)
    } else {
      await db.heroQuest.update({
        where: { id: hq.id },
        data: { progress },
      })
    }
  }
}

async function handleQuestCompletion(heroId: string, hq: any, progress: Record<string, number>) {
  const hero = await db.hero.findFirst({ where: { id: heroId }, select: { userId: true } })
  const rewards = hq.quest.rewards as any

  await db.$transaction([
    db.heroQuest.update({
      where: { id: hq.id },
      data: { status: "completed", progress, completedAt: new Date() },
    }),
    db.hero.update({
      where: { id: heroId },
      data: {
        epTotal: { increment: rewards.ep || 0 },
        gold: { increment: rewards.gold || 0 },
        fame: { increment: rewards.fame || 0 },
      },
    }),
  ])

  if (hero) {
    trackQuestCompleted(hero.userId, { questName: hq.quest.name, questType: hq.quest.type })
  }

  notify({
    heroId, type: "quest_complete",
    title: "¡Quest completada!",
    body: `${hq.quest.name} — +${rewards.ep ?? 0} EP, +${rewards.gold ?? 0} oro`,
    data: { questName: hq.quest.name, rewards },
  }).catch(() => {})

  checkLevelUp(heroId).catch(() => {})
  await grantFactionRepForQuest(heroId, hq.quest.type)
  await chainNextQuest(heroId, hq.quest)
}

async function grantFactionRepForQuest(heroId: string, questType: string) {
  try {
    if (questType === "main") {
      await adjustRep(heroId, 1, 10)
      await adjustRep(heroId, 5, 5)
    } else if (questType === "daily") {
      await adjustRep(heroId, 2, 3)
    } else if (questType === "clan") {
      await adjustRep(heroId, 1, 5)
    }
  } catch (e) {
    console.error('[quest-progress] Error en faction rep:', e)
  }
}

async function chainNextQuest(heroId: string, quest: any) {
  if (!quest.chainNext) return
  const nextQuest = await db.quest.findUnique({ where: { slug: quest.chainNext } })
  if (!nextQuest) return
  const initialProgress: Record<string, number> = {}
  const nextObjs = nextQuest.objectives as any[]
  for (const obj of nextObjs) initialProgress[obj.id] = 0
  await db.heroQuest.upsert({
    where: { heroId_questId: { heroId, questId: nextQuest.id } },
    update: {},
    create: { heroId, questId: nextQuest.id, progress: initialProgress },
  })
}
