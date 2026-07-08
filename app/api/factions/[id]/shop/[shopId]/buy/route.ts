import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; shopId: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const { id, shopId } = await params
  const factionId = Number.parseInt(id)
  if (Number.isNaN(factionId)) return NextResponse.json({ error: "ID inválido" }, { status: 400 })

  const shop = await db.factionShop.findUnique({ where: { id: Number.parseInt(shopId) } })
  if (!shop) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 })
  if (shop.factionId !== factionId) return NextResponse.json({ error: "Tienda no pertenece a esta facción" }, { status: 400 })

  const heroRep = await db.heroFactionRep.findUnique({
    where: { heroId_factionId: { heroId: hero.id, factionId } },
  })
  const rep = heroRep?.rep ?? 0

  if (rep < shop.minRep) {
    return NextResponse.json({ error: `Reputación insuficiente. Necesitás ${shop.minRep}, tenés ${rep}` }, { status: 400 })
  }

  const { itemIndex } = await req.json()
  if (itemIndex === undefined) return NextResponse.json({ error: "Falta itemIndex" }, { status: 400 })

  const items = shop.items as any[]
  const item = items[itemIndex]
  if (!item) return NextResponse.json({ error: "Item no encontrado en la tienda" }, { status: 400 })

  const goldCost = item.goldCost ?? 100
  if (hero.gold < goldCost) {
    return NextResponse.json({ error: `Oro insuficiente. Necesitás ${goldCost}💰` }, { status: 400 })
  }

  await db.$transaction([
    db.hero.update({
      where: { id: hero.id },
      data: { gold: { decrement: goldCost } },
    }),
    db.heroItem.create({
      data: { heroId: hero.id, itemId: item.itemId, equipped: false },
    }),
  ])

  return NextResponse.json({ success: true, item: item.name, goldSpent: goldCost })
}
