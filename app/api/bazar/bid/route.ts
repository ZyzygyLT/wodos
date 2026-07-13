import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { auth } from "@/auth"
import db from "@/lib/db"
import { trackItemPurchased } from "@/lib/analytics/events"
import { notify } from "@/lib/notifications/emitter"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const { listingId, amount } = await req.json()
  if (!listingId) {
    return NextResponse.json({ error: "Falta listingId" }, { status: 400 })
  }

  const listing = await db.bazarListing.findUnique({
    where: { id: listingId },
    include: { purchases: { orderBy: { pricePaid: "desc" }, take: 1 }, heroItem: { include: { item: true } } },
  })
  if (listing?.status !== "active") {
    return NextResponse.json({ error: "Subasta no activa" }, { status: 404 })
  }

  if (listing.sellerId === hero.id) {
    return NextResponse.json({ error: "No podés pujar por tu propio item" }, { status: 400 })
  }

  if (listing.listingType === "fixed") {
    return NextResponse.json({ error: "Usá la compra directa para listings fixed" }, { status: 400 })
  }

  const minBid = (listing.purchases[0]?.pricePaid ?? listing.startPrice ?? listing.price) + 1
  const bidAmount = amount ?? minBid

  if (bidAmount < minBid) {
    return NextResponse.json({ error: `Puja mínima: ${minBid} oro` }, { status: 400 })
  }

  if (hero.gold < bidAmount) {
    return NextResponse.json({ error: "No tenés suficiente oro" }, { status: 400 })
  }

    // Refund previous bidder (last purchase)
  const lastPurchase = listing.purchases[0]
  if (lastPurchase && lastPurchase.buyerId !== hero.id) {
    await db.$transaction([
      db.hero.update({
        where: { id: lastPurchase.buyerId },
        data: { gold: { increment: lastPurchase.pricePaid } },
      }),
      db.hero.update({
        where: { id: hero.id },
        data: { gold: { decrement: bidAmount } },
      }),
      db.bazarPurchase.create({
        data: {
          listingId: listing.id,
          buyerId: hero.id,
          pricePaid: bidAmount,
        },
      }),
    ])
    notify({
      heroId: lastPurchase.buyerId,
      type: "outbid",
      title: "🟡 Superado en la puja",
      body: `Alguien te superó con ${bidAmount}💰`,
    }).catch(e => logger.error("bazar-bid", "Background operation failed", e))
  } else {
    await db.$transaction([
      db.hero.update({
        where: { id: hero.id },
        data: { gold: { decrement: bidAmount } },
      }),
      db.bazarPurchase.create({
        data: {
          listingId: listing.id,
          buyerId: hero.id,
          pricePaid: bidAmount,
        },
      }),
    ])
  }

  // If buyNowPrice reached, auto-sell
  if (listing.buyNowPrice && bidAmount >= listing.buyNowPrice) {
    await finalizeSale(listing.id)
  }

  return NextResponse.json({ success: true, bidAmount })
}

async function finalizeSale(listingId: string) {
  const listing = await db.bazarListing.findUnique({
    where: { id: listingId },
    include: {
      purchases: { orderBy: { pricePaid: "desc" }, take: 1 },
      heroItem: { include: { item: true } },
    },
  })
  if (listing?.status !== "active") return

  const winner = listing.purchases[0]
  if (!winner) return

  const buyer = await db.hero.findFirst({ where: { id: winner.buyerId }, select: { userId: true } })
  if (buyer) {
    trackItemPurchased(buyer.userId, {
      itemName: listing.heroItem.item.name,
      price: winner.pricePaid,
    })
  }

  await db.$transaction([
    db.heroItem.update({
      where: { id: listing.heroItemId },
      data: { heroId: winner.buyerId, equipped: false },
    }),
    db.hero.update({
      where: { id: listing.sellerId },
      data: { gold: { increment: winner.pricePaid } },
    }),
    db.bazarListing.update({
      where: { id: listingId },
      data: { status: "sold" },
    }),
  ])

  notify({
    heroId: listing.sellerId,
    type: "item_sold",
    title: "💰 Item vendido",
    body: `Vendiste "${listing.heroItem.item.name}" por ${winner.pricePaid}💰`,
  }).catch(e => logger.error("bazar-bid", "Background operation failed", e))

  notify({
    heroId: winner.buyerId,
    type: "item_bought",
    title: "🛒 Compra exitosa",
    body: `Compraste "${listing.heroItem.item.name}" por ${winner.pricePaid}💰`,
  }).catch(e => logger.error("bazar-bid", "Background operation failed", e))
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const { listingId } = await req.json()
  if (!listingId) {
    return NextResponse.json({ error: "Falta listingId" }, { status: 400 })
  }

  // Buy now for fixed price or auction buyNowPrice
  const listing = await db.bazarListing.findUnique({
    where: { id: listingId },
    include: {
      purchases: { orderBy: { pricePaid: "desc" }, take: 1 },
    },
  })
  if (listing?.status !== "active") {
    return NextResponse.json({ error: "Listing no activo" }, { status: 404 })
  }

  if (listing.sellerId === hero.id) {
    return NextResponse.json({ error: "No podés comprar tu propio item" }, { status: 400 })
  }

  let price: number
  if (listing.listingType === "fixed") {
    price = listing.price
  } else {
    price = listing.buyNowPrice ?? listing.price
  }

  if (hero.gold < price) {
    return NextResponse.json({ error: "No tenés suficiente oro" }, { status: 400 })
  }

  // Direct purchase - create a purchase record and finalize
  await db.bazarPurchase.create({
    data: {
      listingId: listing.id,
      buyerId: hero.id,
      pricePaid: price,
    },
  })

  await finalizeSale(listing.id)

  return NextResponse.json({ success: true, pricePaid: price })
}
