import db from '@/lib/db'
import { updateQuestProgress } from '@/lib/quests/progress'
import { checkAchievements } from '@/lib/achievements/checker'
import { notify } from '@/lib/notifications/emitter'

const DAY_REWARDS = [
  { gold: 50,  materials: [] },
  { gold: 75,  materials: [] },
  { gold: 100, materials: [{ materialId: 8, qty: 2 }] },
  { gold: 100, materials: [] },
  { gold: 125, materials: [] },
  { gold: 150, materials: [{ materialId: 3, qty: 2 }] },
  { gold: 200, materials: [{ materialId: 6, qty: 1 }] },
]

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate())
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((end.getTime() - start.getTime()) / msPerDay)
}

export interface DailyLoginStatus {
  canClaim: boolean
  streak: number
  todayReward: { gold: number; materials: { name: string; icon: string; qty: number }[] }
  nextRewards: { day: number; gold: number; materials: { name: string; icon: string; qty: number }[] }[]
}

export async function getDailyLoginStatus(
  userId: string,
): Promise<{ ok: boolean; error?: string; status?: number; data?: DailyLoginStatus }> {
  const hero = await db.hero.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { materials: { include: { material: true } } },
  })
  if (!hero) return { ok: false, error: 'Héroe no encontrado', status: 404 }

  const now = new Date()
  const lastLogin = hero.lastLoginAt
  const streak = hero.loginStreak ?? 0

  let canClaim = true
  let effectiveStreak = 0

  if (lastLogin) {
    const diff = daysBetween(lastLogin, now)
    if (diff === 0) {
      canClaim = false
      effectiveStreak = streak
    } else if (diff === 1) {
      effectiveStreak = streak + 1
    } else {
      effectiveStreak = 1
    }
  } else {
    effectiveStreak = 1
  }

  const dayIndex = ((effectiveStreak - 1) % 7)
  const todayReward = DAY_REWARDS[dayIndex]
  const allMaterials = await db.material.findMany()

  const resolveMats = (mats: { materialId: number; qty: number }[]) =>
    mats.map(m => {
      const mat = allMaterials.find(x => x.id === m.materialId)
      return { name: mat?.name ?? `#${m.materialId}`, icon: mat?.icon ?? '📦', qty: m.qty }
    })

  const nextRewards: DailyLoginStatus['nextRewards'] = []
  for (let i = 1; i <= 3; i++) {
    const futureDayIndex = (dayIndex + i) % 7
    const futureReward = DAY_REWARDS[futureDayIndex]
    nextRewards.push({
      day: effectiveStreak + i,
      gold: futureReward.gold,
      materials: resolveMats(futureReward.materials),
    })
  }

  return {
    ok: true,
    data: {
      canClaim,
      streak: effectiveStreak,
      todayReward: { gold: todayReward.gold, materials: resolveMats(todayReward.materials) },
      nextRewards,
    },
  }
}

export interface DailyLoginClaimResult {
  gold: number
  materials: { name: string; icon: string; qty: number }[]
  newStreak: number
}

export async function claimDailyLogin(
  userId: string,
): Promise<{ ok: boolean; error?: string; status?: number; data?: DailyLoginClaimResult }> {
  const hero = await db.hero.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { materials: { include: { material: true } } },
  })
  if (!hero) return { ok: false, error: 'Héroe no encontrado', status: 404 }

  const now = new Date()
  const lastLogin = hero.lastLoginAt
  const streak = hero.loginStreak ?? 0

  if (lastLogin && daysBetween(lastLogin, now) === 0) {
    return { ok: false, error: 'Ya reclamaste tu recompensa de hoy', status: 400 }
  }

  let newStreak = 1
  if (lastLogin) {
    const diff = daysBetween(lastLogin, now)
    newStreak = diff === 1 ? streak + 1 : 1
  }

  const dayIndex = ((newStreak - 1) % 7)
  const reward = DAY_REWARDS[dayIndex]
  const allMaterials = await db.material.findMany()

  await db.$transaction(async (tx) => {
    await tx.hero.update({
      where: { id: hero.id },
      data: { gold: { increment: reward.gold }, lastLoginAt: now, loginStreak: newStreak },
    })
    for (const m of reward.materials) {
      await tx.heroMaterial.upsert({
        where: { heroId_materialId: { heroId: hero.id, materialId: m.materialId } },
        update: { quantity: { increment: m.qty } },
        create: { heroId: hero.id, materialId: m.materialId, quantity: m.qty },
      })
    }
  })

  updateQuestProgress(hero.id, { type: 'login' }).catch(() => {})
  checkAchievements(hero.id, { type: 'login' }).catch(() => {})

  notify({
    heroId: hero.id,
    type: "daily_login",
    title: "📅 ¡Recompensa diaria!",
    body: `Día ${newStreak}: +${reward.gold}💰`,
    data: { streak: newStreak, gold: reward.gold },
  }).catch(() => {})

  const resolvedMats = reward.materials.map(m => {
    const mat = allMaterials.find(x => x.id === m.materialId)
    return { name: mat?.name ?? `#${m.materialId}`, icon: mat?.icon ?? '📦', qty: m.qty }
  })

  return {
    ok: true,
    data: { gold: reward.gold, materials: resolvedMats, newStreak },
  }
}
