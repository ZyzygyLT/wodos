import db from "@/lib/db"
import { trackQuestCompleted } from "@/lib/analytics/events"
import { checkLevelUp } from "@/lib/level-up"
import logger from "@/lib/logger"
import { notify } from "@/lib/notifications/emitter"
import { adjustRep } from "@/services/faction.service"

type QuestProgressEvent = {
  type: "dungeon_complete" | "total_kills" | "ep_total" | "level" | "arena_wins" | "skills_unlocked" | "skills_upgraded" | "enchant_item" | "socket_rune" | "craft_items" | "login"
  dungeonSlug?: string
  kills?: number
  value?: number
  sourceRunId?: string
}

export async function updateQuestProgress(heroId: string, event: QuestProgressEvent) {
  const heroQuests = await db.heroQuest.findMany({
    where: { heroId, status: "active" },
    include: { quest: true },
  })

  for (const candidate of heroQuests) {
    const objectives = candidate.quest.objectives as any[]
    const matching = objectives.filter(obj =>
      obj.type === event.type &&
      !(obj.type === "dungeon_complete" && obj.dungeonSlug && event.dungeonSlug && obj.dungeonSlug !== event.dungeonSlug)
    )
    if (matching.length === 0) continue

    try {
      const completion = await db.$transaction(async tx => {
        if (event.sourceRunId) {
          await tx.dungeonRunRewardGrant.create({
            data: { runId: event.sourceRunId, heroId, kind: `quest_progress:${candidate.id}:${event.type}` },
          })
        }

        // Serialize progress changes for this hero-quest, including concurrent runs.
        await tx.$queryRaw`SELECT "id" FROM "hero_quests" WHERE "id" = ${candidate.id} FOR UPDATE`
        const current = await tx.heroQuest.findUnique({
          where: { id: candidate.id },
          include: { quest: true },
        })
        if (!current || current.status !== "active") return null

        const currentObjectives = current.quest.objectives as any[]
        const progress = { ...(current.progress as Record<string, number>) }
        let updated = false
        const increment = event.kills || event.value || 1
        for (const obj of currentObjectives) {
          if (obj.type !== event.type) continue
          if (obj.type === "dungeon_complete" && obj.dungeonSlug && event.dungeonSlug && obj.dungeonSlug !== event.dungeonSlug) continue
          progress[obj.id] = Math.min((progress[obj.id] || 0) + increment, obj.required)
          updated = true
        }
        if (!updated) return null

        const allDone = currentObjectives.every(obj => (progress[obj.id] || 0) >= obj.required)
        if (!allDone) {
          await tx.heroQuest.update({ where: { id: current.id }, data: { progress } })
          return null
        }

        const claimed = await tx.heroQuest.updateMany({
          where: { id: current.id, status: "active" },
          data: { status: "completed", progress, completedAt: new Date() },
        })
        if (claimed.count !== 1) return null

        const rewards = current.quest.rewards as any
        await tx.hero.update({
          where: { id: heroId },
          data: {
            epTotal: { increment: rewards.ep || 0 },
            gold: { increment: rewards.gold || 0 },
            fame: { increment: rewards.fame || 0 },
          },
        })
        return { quest: current.quest, rewards }
      })

      if (completion) await afterQuestCompletion(heroId, completion.quest, completion.rewards)
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "P2002" && event.sourceRunId) continue
      throw error
    }
  }
}

async function afterQuestCompletion(heroId: string, quest: any, rewards: any) {
  const hero = await db.hero.findFirst({ where: { id: heroId }, select: { userId: true } })
  if (hero) {
    trackQuestCompleted(hero.userId, { questName: quest.name, questType: quest.type })
  }

  notify({
    heroId, type: "quest_complete",
    title: "¡Quest completada!",
    body: `${quest.name} — +${rewards.ep ?? 0} EP, +${rewards.gold ?? 0} oro`,
    data: { questName: quest.name, rewards },
  }).catch(e => logger.error("quests", "Quest completion notification failed", e))

  checkLevelUp(heroId).catch(e => logger.error("quests", "Quest completion level-up failed", e))
  await grantFactionRepForQuest(heroId, quest.type)
  await chainNextQuest(heroId, quest)
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
    logger.error("quest-progress", "Error en faction rep", e)
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
