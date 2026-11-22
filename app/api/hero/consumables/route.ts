import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { updateQuestProgress } from "@/lib/quests/progress"
import { checkAchievements } from "@/lib/achievements/checker"
import { assertHeroItemNotListed } from "@/services/bazar-item-guard"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, {
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

  const { heroItemId } = await req.json()
  if (typeof heroItemId !== "string" || !heroItemId) {
    return NextResponse.json({ error: "Falta heroItemId" }, { status: 400 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const result = await db.$transaction(async tx => {
    // Serialize consumable effects with combat, other consumables and resource changes.
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${hero.id} FOR UPDATE`

    const currentHero = await tx.hero.findUnique({
      where: { id: hero.id },
      select: { id: true, hpCurrent: true, hpMax: true, mpCurrent: true, mpMax: true },
    })
    if (!currentHero) throw new Error("HERO_NOT_FOUND")

    // A registered/running expedition uses an immutable participant snapshot.
    // Prevent consumable changes until that snapshot is no longer active.
    const activeRun = await tx.dungeonRun.findFirst({
      where: {
        status: { in: ["registered", "running"] },
        OR: [
          { heroId: hero.id },
          { participants: { some: { heroId: hero.id } } },
        ],
      },
      select: { id: true },
    })
    if (activeRun) throw new Error("CONSUMABLE_EXPEDITION_ACTIVE")

    const hi = await tx.heroItem.findFirst({
      where: { id: heroItemId, heroId: hero.id, item: { category: "consumable" } },
      include: { item: true },
    })
    if (!hi) throw new Error("CONSUMABLE_STALE")

    await assertHeroItemNotListed(tx, hi.id, hero.id)

    const stats = hi.item.stats as Record<string, number> | null
    if (!stats) throw new Error("CONSUMABLE_NO_EFFECTS")

    const updateData: Record<string, number> = {}
    if (typeof stats.healHp === "number" && stats.healHp > 0) {
      updateData.hpCurrent = Math.min(currentHero.hpCurrent + stats.healHp, currentHero.hpMax)
    }
    if (typeof stats.healMp === "number" && stats.healMp > 0) {
      updateData.mpCurrent = Math.min(currentHero.mpCurrent + stats.healMp, currentHero.mpMax)
    }
    if (Object.keys(updateData).length === 0) throw new Error("CONSUMABLE_NO_EFFECTS")

    await tx.hero.update({ where: { id: hero.id }, data: updateData })
    const consumed = await tx.heroItem.deleteMany({ where: { id: hi.id, heroId: hero.id } })
    if (consumed.count !== 1) throw new Error("CONSUMABLE_STALE")

    return { effects: stats, hpCurrent: updateData.hpCurrent, mpCurrent: updateData.mpCurrent }
  }).catch(error => {
    if (error instanceof Error && error.message === "ITEM_LISTED") {
      return { error: "No podés usar un consumible mientras esté publicado en el bazar.", status: 409 }
    }
    if (error instanceof Error && error.message === "CONSUMABLE_STALE") {
      return { error: "El consumible ya no está disponible.", status: 409 }
    }
    if (error instanceof Error && error.message === "HERO_NOT_FOUND") {
      return { error: "Héroe no encontrado", status: 404 }
    }
    if (error instanceof Error && error.message === "CONSUMABLE_EXPEDITION_ACTIVE") {
      return { error: "No podés usar consumibles mientras participás en una expedición activa.", status: 409 }
    }
    if (error instanceof Error && error.message === "CONSUMABLE_NO_EFFECTS") {
      return { error: "Este item no tiene efectos válidos", status: 400 }
    }
    throw error
  })

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })

  updateQuestProgress(hero.id, { type: "craft_items" }).catch(e => logger.error("api", "Background operation failed", e))
  checkAchievements(hero.id, { type: "craft_items" }).catch(e => logger.error("api", "Background operation failed", e))

  return NextResponse.json({ success: true, ...result })
}
