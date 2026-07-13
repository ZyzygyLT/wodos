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

  if (hero.gold < item.price) {
    return NextResponse.json({ error: `No tenés suficiente oro. Necesitás ${item.price}💰` }, { status: 400 })
  }

  if (item.category !== 'consumable' && item.category !== 'rune') {
    const alreadyOwns = hero.items.some(hi => hi.itemId === itemId)
    if (alreadyOwns) {
      return NextResponse.json({ error: "Ya tenés este item" }, { status: 400 })
    }
  }

  const price = item.price ?? 0
  const result = await db.$transaction(async (tx) => {
    const freshHero = await tx.hero.findUnique({ where: { id: hero.id } })
    if (!freshHero || freshHero.gold < price) {
      return { error: `No tenés suficiente oro. Necesitás ${price}💰` }
    }
    await tx.hero.update({
      where: { id: hero.id },
      data: {
        gold: { decrement: price },
        items: {
          create: { itemId: item.id, equipped: false },
        },
      },
    })
    return { success: true }
  })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, name: item.name, price: item.price })
}
