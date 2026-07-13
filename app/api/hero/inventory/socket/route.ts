import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { auth } from "@/auth"
import db from "@/lib/db"
import { updateQuestProgress } from "@/lib/quests/progress"
import { checkAchievements } from "@/lib/achievements/checker"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      items: {
        where: { item: { category: "rune" } },
        include: { item: true },
      },
    },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  return NextResponse.json(hero.items)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { heroItemId, slotIndex, runeHeroItemId } = await req.json()
  if (heroItemId == null || slotIndex == null || !runeHeroItemId) {
    return NextResponse.json({ error: "heroItemId, slotIndex y runeHeroItemId requeridos" }, { status: 400 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { items: { include: { item: true } } },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const target = hero.items.find(i => i.id === heroItemId)
  if (!target) return NextResponse.json({ error: "Item no encontrado" }, { status: 404 })

  if (slotIndex < 0 || slotIndex >= target.item.runeSlots) {
    return NextResponse.json({ error: "Slot inválido" }, { status: 400 })
  }

  const runesIn = (target.runesIn as any[]) ?? []
  if (runesIn.some(r => r.slotIndex === slotIndex)) {
    return NextResponse.json({ error: "Slot ya ocupado" }, { status: 400 })
  }

  const runeHeroItem = hero.items.find(i => i.id === runeHeroItemId && i.item.category === "rune")
  if (!runeHeroItem) return NextResponse.json({ error: "Runa no encontrada" }, { status: 404 })

  if (runeHeroItem.equipped) {
    return NextResponse.json({ error: "De-equipá la runa primero" }, { status: 400 })
  }

  runesIn.push({ slotIndex, itemId: runeHeroItem.itemId })

  await db.$transaction([
    db.heroItem.update({
      where: { id: heroItemId },
      data: { runesIn },
    }),
    db.heroItem.delete({ where: { id: runeHeroItemId } }),
  ])

  updateQuestProgress(hero.id, { type: "socket_rune" }).catch(e => logger.error("api", "Background operation failed", e))
  checkAchievements(hero.id, { type: "socket_rune" }).catch(e => logger.error("api", "Background operation failed", e))

  return NextResponse.json({ success: true })
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const { heroItemId, slotIndex } = await req.json()
  if (heroItemId == null || slotIndex == null) {
    return NextResponse.json({ error: "heroItemId y slotIndex requeridos" }, { status: 400 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { items: { include: { item: true } } },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const target = hero.items.find(i => i.id === heroItemId)
  if (!target) return NextResponse.json({ error: "Item no encontrado" }, { status: 404 })

  const runesIn = (target.runesIn as any[]) ?? []
  const idx = runesIn.findIndex(r => r.slotIndex === slotIndex)
  if (idx === -1) return NextResponse.json({ error: "Slot vacío" }, { status: 400 })

  const [removed] = runesIn.splice(idx, 1)

  await db.$transaction([
    db.heroItem.update({
      where: { id: heroItemId },
      data: { runesIn },
    }),
    db.heroItem.create({
      data: { heroId: hero.id, itemId: removed.itemId, equipped: false },
    }),
  ])

  return NextResponse.json({ success: true })
}
