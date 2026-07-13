import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { auth } from "@/auth"
import db from "@/lib/db"
import { updateQuestProgress } from "@/lib/quests/progress"
import { checkAchievements } from "@/lib/achievements/checker"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      items: {
        where: { item: { category: 'consumable' } },
        include: { item: true },
      },
    },
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  return NextResponse.json(hero.items.map(hi => ({
    heroItemId: hi.id,
    itemId: hi.item.id,
    name: hi.item.name,
    icon: hi.item.icon,
    description: hi.item.description,
    stats: hi.item.stats,
  })))
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { items: { include: { item: true } } },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { heroItemId } = await req.json()
  if (!heroItemId) return NextResponse.json({ error: "Falta heroItemId" }, { status: 400 })

  const hi = hero.items.find(i => i.id === heroItemId && i.item.category === "consumable")
  if (!hi) return NextResponse.json({ error: "Consumible no encontrado" }, { status: 404 })

  const stats = hi.item.stats as Record<string, number> | null
  if (!stats) return NextResponse.json({ error: "Este item no tiene efectos" }, { status: 400 })

  const updateData: Record<string, number> = {}
  if (stats.healHp) updateData.hpCurrent = Math.min(hero.hpCurrent + stats.healHp, hero.hpMax)
  if (stats.healMp) updateData.mpCurrent = Math.min(hero.mpCurrent + stats.healMp, hero.mpMax)

  await db.$transaction([
    db.hero.update({ where: { id: hero.id }, data: updateData }),
    db.heroItem.delete({ where: { id: hi.id } }),
  ])

  updateQuestProgress(hero.id, { type: "craft_items" }).catch(e => logger.error("api", "Background operation failed", e))
  checkAchievements(hero.id, { type: "craft_items" }).catch(e => logger.error("api", "Background operation failed", e))

  return NextResponse.json({ success: true, effects: stats, hpCurrent: updateData.hpCurrent, mpCurrent: updateData.mpCurrent })
}
