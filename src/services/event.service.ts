import db from "@/lib/db"
import { notify } from "@/lib/notifications/emitter"

export type EventType = "xp_boost" | "gold_boost" | "dungeon_challenge" | "pvp_tournament" | "crafting_spree" | "boss_hunt"

export interface EventTemplate {
  name: string
  description: string
  type: string
  dungeonId?: number
  target: number
}

const EVENT_TEMPLATES: EventTemplate[] = [
  {
    name: "Semana de Experiencia Doble",
    description: "Ganá el doble de experiencia en todos los dungeons durante toda la semana.",
    type: "xp_boost",
    target: 5,
  },
  {
    name: "Festival del Oro",
    description: "Los enemigos sueltan el doble de oro. ¡A farmear!",
    type: "gold_boost",
    target: 5,
  },
  {
    name: "Desafío de Dungeons",
    description: "Completá 10 dungeons para ganar recompensas especiales.",
    type: "dungeon_challenge",
    target: 10,
  },
  {
    name: "Torneo PvP Semanal",
    description: "Ganá 5 duelos PvP para escalar en el ranking y ganar recompensas.",
    type: "pvp_tournament",
    target: 5,
  },
  {
    name: "Maratón de Crafting",
    description: "Creá 8 ítems para demostrar tu habilidad de herrero.",
    type: "crafting_spree",
    target: 8,
  },
  {
    name: "Cacería de Jefes",
    description: "Derrotá 3 jefes en dungeons para ganar loot exclusivo.",
    type: "boss_hunt",
    target: 3,
  },
]

export async function generateWeeklyEvents(): Promise<void> {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  const existingEvents = await db.weeklyEvent.findMany({
    where: {
      startsAt: { gte: startOfWeek },
      endsAt: { lte: endOfWeek },
    },
  })

  if (existingEvents.length >= 2) return

  const weekNumber = Math.floor(now.getTime() / (7 * 24 * 60 * 60 * 1000))
  const selected: EventTemplate[] = []
  const usedIndices = new Set<number>()

  for (let i = 0; i < 2; i++) {
    const index = (weekNumber + i + now.getDay()) % EVENT_TEMPLATES.length
    if (!usedIndices.has(index)) {
      usedIndices.add(index)
      selected.push(EVENT_TEMPLATES[index])
    }
  }

  for (const template of selected) {
    const rewards = calculateRewards(template.type)
    await db.weeklyEvent.create({
      data: {
        name: template.name,
        description: template.description,
        type: template.type,
        dungeonId: template.dungeonId,
        startsAt: startOfWeek,
        endsAt: endOfWeek,
        isActive: true,
        rewards,
      },
    })
  }
}

function calculateRewards(type: string): any[] {
  const baseGold = 100
  const baseFame = 10

  switch (type) {
    case "xp_boost":
      return [
        { rank: "1", fame: baseFame * 3, gold: baseGold * 3 },
        { rank: "2-3", fame: baseFame * 2, gold: baseGold * 2 },
        { rank: "top10pct", fame: baseFame, gold: baseGold },
        { rank: "participant", fame: Math.floor(baseFame / 2), gold: Math.floor(baseGold / 2) },
      ]
    case "gold_boost":
      return [
        { rank: "1", fame: baseFame * 2, gold: baseGold * 4 },
        { rank: "2-3", fame: baseFame, gold: baseGold * 3 },
        { rank: "top10pct", fame: Math.floor(baseFame / 2), gold: baseGold * 2 },
        { rank: "participant", fame: Math.floor(baseFame / 4), gold: baseGold },
      ]
    case "dungeon_challenge":
      return [
        { rank: "1", fame: baseFame * 3, gold: baseGold * 2 },
        { rank: "2-3", fame: baseFame * 2, gold: baseGold },
        { rank: "top10pct", fame: baseFame, gold: Math.floor(baseGold / 2) },
        { rank: "participant", fame: Math.floor(baseFame / 2), gold: Math.floor(baseGold / 4) },
      ]
    case "pvp_tournament":
      return [
        { rank: "1", fame: baseFame * 4, gold: baseGold * 3 },
        { rank: "2-3", fame: baseFame * 2, gold: baseGold * 2 },
        { rank: "top10pct", fame: baseFame, gold: baseGold },
        { rank: "participant", fame: Math.floor(baseFame / 2), gold: Math.floor(baseGold / 2) },
      ]
    case "crafting_spree":
      return [
        { rank: "1", fame: baseFame * 2, gold: baseGold * 2 },
        { rank: "2-3", fame: baseFame, gold: baseGold * 1.5 },
        { rank: "top10pct", fame: Math.floor(baseFame / 2), gold: baseGold },
        { rank: "participant", fame: Math.floor(baseFame / 4), gold: Math.floor(baseGold / 2) },
      ]
    case "boss_hunt":
      return [
        { rank: "1", fame: baseFame * 5, gold: baseGold * 5 },
        { rank: "2-3", fame: baseFame * 3, gold: baseGold * 3 },
        { rank: "top10pct", fame: baseFame * 2, gold: baseGold * 2 },
        { rank: "participant", fame: baseFame, gold: baseGold },
      ]
    default:
      return [
        { rank: "participant", fame: baseFame, gold: baseGold },
      ]
  }
}

export async function trackHeroEventProgress(
  heroId: string,
  eventType: string,
  amount: number = 1,
  sourceRunId?: string,
): Promise<void> {
  // Keep the execution vocabulary aligned with both generated and legacy event types.
  const eventTypeAliases: Record<string, string[]> = {
    invasion: ['invasion', 'kill_enemies'],
    dungeon: ['dungeon', 'dungeon_challenge'],
    boss: ['boss', 'boss_hunt', 'kill_boss'],
  }
  const matchingTypes = eventTypeAliases[eventType] ?? [eventType]
  const activeEvents = await db.weeklyEvent.findMany({
    where: {
      type: matchingTypes.length === 1 ? matchingTypes[0] : { in: matchingTypes },
      isActive: true,
      startsAt: { lte: new Date() },
      endsAt: { gte: new Date() },
    },
  })

  for (const event of activeEvents) {
    let completedNow = false
    try {
      if (sourceRunId) {
        await db.$transaction(async tx => {
          // The unique reward-grant key makes a replay of this run a no-op.
          await tx.dungeonRunRewardGrant.create({
            data: { runId: sourceRunId, heroId, kind: `event_progress:${event.id}:${eventType}` },
          })
          const participation = await tx.heroEventParticipation.upsert({
            where: { heroId_eventId: { heroId, eventId: event.id } },
            update: { progress: { increment: amount } },
            create: { heroId, eventId: event.id, progress: amount, target: getTargetForType(event.type) },
          })
          if (participation.progress >= participation.target && !participation.completed) {
            await tx.heroEventParticipation.update({
              where: { heroId_eventId: { heroId, eventId: event.id } },
              data: { completed: true },
            })
            completedNow = true
          }
        })
      } else {
        const participation = await db.heroEventParticipation.upsert({
          where: { heroId_eventId: { heroId, eventId: event.id } },
          update: { progress: { increment: amount } },
          create: { heroId, eventId: event.id, progress: amount, target: getTargetForType(event.type) },
        })
        if (participation.progress >= participation.target && !participation.completed) {
          await db.heroEventParticipation.update({
            where: { heroId_eventId: { heroId, eventId: event.id } },
            data: { completed: true },
          })
          completedNow = true
        }
      }
    } catch (error) {
      if (sourceRunId && typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        continue
      }
      throw error
    }

    if (completedNow) {
      await notify({
        heroId,
        type: "event",
        title: "¡Evento completado!",
        body: `Completaste "${event.name}". Reclamá tu recompensa.`,
        data: { eventId: event.id, url: "/events" },
      })
    }
  }
}

function getTargetForType(type: string): number {
  const template = EVENT_TEMPLATES.find(t => t.type === type)
  return template?.target ?? 5
}

export async function claimHeroEventReward(heroId: string, eventId: string): Promise<{ success: boolean; error?: string; reward?: any }> {
  const participation = await db.heroEventParticipation.findUnique({
    where: { heroId_eventId: { heroId, eventId } },
    include: { event: true },
  })

  if (!participation) return { success: false, error: "No participás en este evento" }
  if (!participation.completed) return { success: false, error: "Evento no completado" }
  if (participation.claimedAt) return { success: false, error: "Ya reclamaste la recompensa" }

  const rewards = participation.event.rewards as any[]
  const rank = "participant"
  const rewardTier = rewards.find((r: any) => r.rank === rank) ?? rewards.at(-1)

  if (!rewardTier) return { success: false, error: "No hay recompensa disponible" }

  const fameGained = rewardTier.fame ?? 0
  const goldGained = rewardTier.gold ?? 0

  try {
    await db.$transaction(async tx => {
      const claimed = await tx.heroEventParticipation.updateMany({
        where: { heroId, eventId, completed: true, claimedAt: null },
        data: { claimedAt: new Date() },
      })
      if (claimed.count !== 1) throw new Error("EVENT_REWARD_ALREADY_CLAIMED")

      await tx.hero.update({
        where: { id: heroId },
        data: {
          fame: { increment: fameGained },
          gold: { increment: goldGained },
        },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === "EVENT_REWARD_ALREADY_CLAIMED") {
      return { success: false, error: "Ya reclamaste la recompensa" }
    }
    throw error
  }

  return { success: true, reward: { fame: fameGained, gold: goldGained } }
}
