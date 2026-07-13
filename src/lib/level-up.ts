import db from "@/lib/db"
import { updateQuestProgress } from "@/lib/quests/progress"
import { checkAchievements } from "@/lib/achievements/checker"
import { calcHpMax, calcMpMax, HeroAttrs } from "@/lib/combat-engine/formulas"
import { notify } from "@/lib/notifications/emitter"

const POINTS_PER_LEVEL = 5

export function epForLevel(level: number): number {
  return Math.round(200 * Math.pow(1.6, level - 1))
}

export function totalEpForLevel(level: number): number {
  let total = 0
  for (let i = 1; i < level; i++) {
    total += epForLevel(i)
  }
  return total
}

export function levelFromEp(epTotal: number): number {
  let level = 1
  while (totalEpForLevel(level + 1) <= epTotal) level++
  return level
}

export interface LevelUpResult {
  leveledUp: boolean
  levelsGained: number
  newLevel: number
  newHpMax: number
  newMpMax: number
  pointsAwarded: number
}

export async function checkLevelUp(heroId: string): Promise<LevelUpResult> {
  const hero = await db.hero.findFirst({ where: { id: heroId } })
  if (!hero) throw new Error("Hero not found")

  let levelsGained = 0
  let newLevel = hero.level
  let newHpMax = hero.hpMax
  let newMpMax = hero.mpMax

  const attrs = hero.attrs as unknown as HeroAttrs

  while (hero.epTotal >= totalEpForLevel(newLevel + 1)) {
    newLevel++
    levelsGained++
    newHpMax = calcHpMax(attrs, newLevel)
    newMpMax = calcMpMax(attrs)
  }

  if (levelsGained === 0) {
    return { leveledUp: false, levelsGained: 0, newLevel, newHpMax, newMpMax, pointsAwarded: 0 }
  }

  const pointsAwarded = levelsGained * POINTS_PER_LEVEL

  await db.hero.update({
    where: { id: heroId },
    data: {
      level: newLevel,
      hpMax: newHpMax,
      mpMax: newMpMax,
      hpCurrent: newHpMax,
      mpCurrent: newMpMax,
      freeAttrPoints: { increment: pointsAwarded },
    }
  })

  updateQuestProgress(heroId, { type: "level" }).catch(e => logger.error("level-up", "Background operation failed", e))
  checkAchievements(heroId, { type: "level" }).catch(e => logger.error("level-up", "Background operation failed", e))

  notify({
    heroId,
    type: "level_up",
    title: `¡Subiste a nivel ${newLevel}!`,
    body: `Ganaste ${pointsAwarded} puntos de atributo. HP: ${newHpMax}, MP: ${newMpMax}`,
    data: { newLevel, levelsGained, pointsAwarded },
  }).catch(e => logger.error("level-up", "Background operation failed", e))

  return {
    leveledUp: true,
    levelsGained,
    newLevel,
    newHpMax,
    newMpMax,
    pointsAwarded,
  }
}
