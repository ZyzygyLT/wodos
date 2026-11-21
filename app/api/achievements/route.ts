import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const [achievements, heroAchievements] = await Promise.all([
    db.achievement.findMany({ orderBy: { order: "asc" } }),
    db.heroAchievement.findMany({ where: { heroId: hero.id } }),
  ])

  const haMap = new Map(heroAchievements.map(h => [h.achievementId, h]))

  const result = achievements.map(a => {
    const ha = haMap.get(a.id)
    return {
      ...a,
      progress: ha?.progress ?? {},
      completed: ha?.completed ?? false,
      completedAt: ha?.completedAt ?? null,
    }
  })

  return NextResponse.json({ achievements: result })
}
