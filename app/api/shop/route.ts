import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { items: true },
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const ownedItemIds = new Set(hero.items.map(hi => hi.itemId))

  const items = await db.item.findMany({
    where: { price: { not: null } },
    orderBy: [{ rarity: 'asc' }, { price: 'asc' }],
  })

  const itemsWithOwned = items.map(item => ({
    ...item,
    owned: item.category !== 'consumable' && ownedItemIds.has(item.id),
  }))

  return NextResponse.json({ items: itemsWithOwned, gold: hero.gold })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { items: true },
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const { itemId } = await req.json()
  if (!itemId || typeof itemId !== 'number') {
    return NextResponse.json({ error: "itemId requerido" }, { status: 400 })
  }

  const item = await db.item.findUnique({ where: { id: itemId } })
  if (!item?.price) {
    return NextResponse.json({ error: "Item no disponible en tienda" }, { status: 400 })
  }

  const price = item.price
  try {
    await db.$transaction(async tx => {
      const freshHero = await tx.hero.findUnique({ where: { id: hero.id }, select: { id: true } })
      if (!freshHero) throw new Error("HERO_NOT_FOUND")

      if (item.category !== 'consumable' && item.category !== 'rune') {
        const alreadyOwns = await tx.heroItem.findFirst({
          where: { heroId: hero.id, itemId },
          select: { id: true },
        })
        if (alreadyOwns) throw new Error("ITEM_ALREADY_OWNED")
      }

      const debit = await tx.hero.updateMany({
        where: { id: hero.id, gold: { gte: price } },
        data: { gold: { decrement: price } },
      })
      if (debit.count !== 1) throw new Error("SHOP_INSUFFICIENT_GOLD")

      await tx.heroItem.create({
        data: { heroId: hero.id, itemId: item.id, equipped: false },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === "SHOP_INSUFFICIENT_GOLD") {
      return NextResponse.json({ error: `No tenés suficiente oro. Necesitás ${price}💰` }, { status: 400 })
    }
    if (error instanceof Error && error.message === "ITEM_ALREADY_OWNED") {
      return NextResponse.json({ error: "Ya tenés este item" }, { status: 400 })
    }
    if (error instanceof Error && error.message === "HERO_NOT_FOUND") {
      return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
    }
    throw error
  }

  return NextResponse.json({ success: true, name: item.name, price: item.price })
}
