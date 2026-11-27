import db from "@/lib/db"
import { notify } from "@/lib/notifications/emitter"
import logger from "@/lib/logger"

export async function checkAchievements(heroId: string, event: {
  type: "dungeon_complete" | "level" | "arena_wins" | "join_clan" | "craft_items" | "items_acquired" | "gold_accumulated" | "fame" | "enchant_level" | "socket_rune" | "skills_unlocked" | "skills_upgraded" | "login"
  value?: number
}) {
  const hero = await db.hero.findFirst({
    where: { id: heroId },
    select: { id: true, userId: true, level: true, fame: true, gold: true, arenaWins: true, _count: { select: { items: true } } },
  })
  if (!hero) return

  const achievements = await db.achievement.findMany()
  const heroAch = await db.heroAchievement.findMany({ where: { heroId } })
  const completedSlugs = new Set(heroAch.filter(h => h.completed).map(h => h.achievementId))

  const heroStats = await buildHeroStats(heroId, hero, event)

  const newCompletions: string[] = []

  for (const ach of achievements) {
    if (completedSlugs.has(ach.id)) continue

    const cond = ach.condition as { type: string; target: number }
    const current = heroStats[cond.type as keyof typeof heroStats] ?? 0
    const progress = Math.min(current, cond.target)
    const isComplete = current >= cond.target

    await db.heroAchievement.upsert({
      where: { heroId_achievementId: { heroId, achievementId: ach.id } },
      update: { progress: { [cond.type]: progress }, completed: isComplete, completedAt: isComplete ? new Date() : null },
      create: { heroId, achievementId: ach.id, progress: { [cond.type]: progress }, completed: isComplete, completedAt: isComplete ? new Date() : null },
    })

    if (isComplete) {
      newCompletions.push(ach.name)
      notify({
        heroId,
        type: "achievement_unlock",
        title: `🏅 ¡Logro desbloqueado!`,
        body: ach.name,
        data: { achievementId: ach.id, achievementName: ach.name },
        dedupeKey: `achievement:${heroId}:${ach.id}`,
      }).catch(e => logger.error("achievements", "Background achievement check failed", e))
    }
  }

  return newCompletions
}

type AchievementEvent = Parameters<typeof checkAchievements>[1]

async function buildHeroStats(heroId: string, hero: any, event: AchievementEvent) {
  const stats: Record<string, number> = {
    dungeon_complete: event.type === "dungeon_complete" ? (event.value ?? 1) : 0,
    level: hero.level,
    arena_wins: hero.arenaWins,
    join_clan: 0,
    craft_items: 0,
    items_acquired: hero._count.items,
    gold_accumulated: hero.gold,
    fame: hero.fame,
    enchant_level: 0,
    socket_rune: 0,
    skills_unlocked: 0,
    skills_upgraded: 0,
    login: 0,
  }

  switch (event.type) {
    case "craft_items":
      stats.craft_items = await db.heroItem.count({ where: { heroId } })
      break
    case "join_clan": {
      const member = await db.clanMember.findUnique({ where: { heroId } })
      stats.join_clan = member ? 1 : 0
      break
    }
    case "enchant_level": {
      const maxLevel = await db.heroItem.aggregate({ where: { heroId, upgradeLevel: { gt: 0 } }, _max: { upgradeLevel: true } })
      stats.enchant_level = maxLevel._max.upgradeLevel ?? 0
      break
    }
    case "socket_rune": {
      const count = await db.heroItem.count({ where: { heroId, runesIn: { not: "[]" } } })
      stats.socket_rune = count > 0 ? 1 : 0
      break
    }
    case "skills_unlocked":
      stats.skills_unlocked = await db.heroSkill.count({ where: { heroId } })
      break
    case "skills_upgraded": {
      const maxRank = await db.heroSkill.aggregate({ where: { heroId }, _max: { rank: true } })
      stats.skills_upgraded = maxRank._max.rank ?? 0
      break
    }
    case "login": {
      const h = await db.hero.findFirst({ where: { id: heroId }, select: { loginStreak: true } })
      stats.login = h?.loginStreak ?? 0
      break
    }
  }

  return stats
}
