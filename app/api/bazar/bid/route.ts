import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { trackItemPurchased } from "@/lib/analytics/events"
import { notify } from "@/lib/notifications/emitter"

type TransactionResult =
  | { error: string; status: number }
  | {
      success: true
      pricePaid: number
      itemName: string
      sellerId: string
      buyerId: string
      buyerUserId: string
      sellerUserId: string
      outbidHeroId?: string
      autoSold: boolean
    }

function isError(result: TransactionResult): result is Extract<TransactionResult, { error: string }> {
  return "error" in result
}

async function getAuthenticatedHero() {
  const session = await auth()
  if (!session?.user?.id) return { error: "No autenticado", status: 401 as const }

  const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true, userId: true } })
  if (!hero) return { error: "No tenés un héroe", status: 404 as const }
  return { hero }
}

function sendSaleNotifications(result: Extract<TransactionResult, { success: true }>) {
  trackItemPurchased(result.buyerUserId, {
    itemName: result.itemName,
    price: result.pricePaid,
  })

  notify({
    heroId: result.sellerId,
    type: "item_sold",
    title: "💰 Item vendido",
    body: `Vendiste "${result.itemName}" por ${result.pricePaid}💰`,
  }).catch(e => logger.error("bazar-sale", "Seller notification failed", e))

  notify({
    heroId: result.buyerId,
    type: "item_bought",
    title: "🛒 Compra exitosa",
    body: `Compraste "${result.itemName}" por ${result.pricePaid}💰`,
  }).catch(e => logger.error("bazar-sale", "Buyer notification failed", e))
}

export async function POST(req: NextRequest) {
  const authResult = await getAuthenticatedHero()
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  let body: { listingId?: unknown; amount?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
  }

  const listingId = typeof body.listingId === "string" ? body.listingId : ""
  const amount = body.amount
  if (!listingId || (amount !== undefined && (!Number.isSafeInteger(amount) || (amount as number) <= 0))) {
    return NextResponse.json({ error: "Datos de puja inválidos" }, { status: 400 })
  }

  const buyerId = authResult.hero.id

  let result: TransactionResult
  try {
    result = await db.$transaction(async tx => {
      // Serialize every bid and buy-now attempt for this listing.
      await tx.$queryRaw`SELECT id FROM bazar_listings WHERE id = ${listingId} FOR UPDATE`

      const listing = await tx.bazarListing.findUnique({
        where: { id: listingId },
        include: {
          heroItem: { include: { item: true } },
          seller: { select: { userId: true } },
        },
      })

      if (!listing || listing.status !== "active") {
        return { error: "Subasta no activa", status: 404 }
      }
      if (listing.expiresAt <= new Date()) {
        return { error: "La subasta ha expirado", status: 400 }
      }
      if (listing.sellerId === buyerId) {
        return { error: "No podés pujar por tu propio item", status: 400 }
      }
      if (listing.listingType !== "auction") {
        return { error: "Usá la compra directa para listings fixed", status: 400 }
      }

      const previousBid = await tx.bazarPurchase.findFirst({
        where: { listingId: listing.id, cycle: listing.cycle },
        orderBy: [{ pricePaid: "desc" }, { purchasedAt: "desc" }],
      })
      const minBid = (previousBid?.pricePaid ?? listing.startPrice ?? listing.price) + 1
      const bidAmount = amount === undefined ? minBid : amount as number
      if (bidAmount < minBid) {
        return { error: `Puja mínima: ${minBid} oro`, status: 400 }
      }

      // The previous leader's escrow is refunded; a returning leader pays only
      // the increase over their already-escrowed bid.
      // Lock all affected wallets in a stable order to avoid cross-auction deadlocks.
      const walletIds = [...new Set([buyerId, listing.sellerId, ...(previousBid ? [previousBid.buyerId] : [])])].sort()
      await tx.$queryRaw`SELECT id FROM heroes WHERE id = ANY(${walletIds}::text[]) ORDER BY id FOR UPDATE`

      const autoSold = listing.buyNowPrice !== null && bidAmount >= listing.buyNowPrice
      // A bid that reaches or exceeds buy-now settles at the advertised buy-now
      // price, never at an arbitrary amount supplied above that threshold.
      const acceptedBidAmount = autoSold ? listing.buyNowPrice! : bidAmount
      const charge = previousBid?.buyerId === buyerId
        ? acceptedBidAmount - previousBid.pricePaid
        : acceptedBidAmount

      if (previousBid && previousBid.buyerId !== buyerId) {
        await tx.hero.update({
          where: { id: previousBid.buyerId },
          data: { gold: { increment: previousBid.pricePaid } },
        })
      }

      if (charge > 0) {
        const debit = await tx.hero.updateMany({
          where: { id: buyerId, gold: { gte: charge } },
          data: { gold: { decrement: charge } },
        })
        if (debit.count !== 1) {
          throw new Error("INSUFFICIENT_GOLD")
        }
      }

      await tx.bazarPurchase.create({
        data: { listingId: listing.id, buyerId, pricePaid: acceptedBidAmount, cycle: listing.cycle },
      })

      if (autoSold) {
        const itemTransfer = await tx.heroItem.updateMany({
          where: { id: listing.heroItemId, heroId: listing.sellerId, equipped: false },
          data: { heroId: buyerId, equipped: false, slot: null },
        })
        if (itemTransfer.count !== 1) throw new Error("ITEM_TRANSFER_FAILED")

        await tx.hero.update({
          where: { id: listing.sellerId },
          data: { gold: { increment: acceptedBidAmount } },
        })

        const closed = await tx.bazarListing.updateMany({
          where: { id: listing.id, status: "active" },
          data: { status: "sold" },
        })
        if (closed.count !== 1) throw new Error("LISTING_ALREADY_CLOSED")
      }

      return {
        success: true,
        pricePaid: acceptedBidAmount,
        itemName: listing.heroItem.item.name,
        sellerId: listing.sellerId,
        buyerId,
        buyerUserId: authResult.hero.userId,
        sellerUserId: listing.seller.userId,
        outbidHeroId: previousBid && previousBid.buyerId !== buyerId ? previousBid.buyerId : undefined,
        autoSold,
      }
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : ""
    if (code === "INSUFFICIENT_GOLD") {
      return NextResponse.json({ error: "No tenés suficiente oro" }, { status: 400 })
    }
    if (code === "ITEM_TRANSFER_FAILED" || code === "LISTING_ALREADY_CLOSED") {
      return NextResponse.json({ error: "La publicación cambió durante la operación. Actualizá el bazar." }, { status: 409 })
    }
    throw error
  }

  if (isError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  if (result.outbidHeroId) {
    notify({
      heroId: result.outbidHeroId,
      type: "outbid",
      title: "🟡 Superado en la puja",
      body: `Alguien te superó con ${result.pricePaid}💰`,
    }).catch(e => logger.error("bazar-bid", "Outbid notification failed", e))
  }

  if (result.autoSold) sendSaleNotifications(result)

  return NextResponse.json({ success: true, bidAmount: result.pricePaid, autoSold: result.autoSold })
}

export async function PUT(req: NextRequest) {
  const authResult = await getAuthenticatedHero()
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status })
  }

  let body: { listingId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
  }

  const listingId = typeof body.listingId === "string" ? body.listingId : ""
  if (!listingId) return NextResponse.json({ error: "Falta listingId" }, { status: 400 })

  const buyerId = authResult.hero.id
  let result: TransactionResult
  try {
    result = await db.$transaction(async tx => {
      // Lock the listing before reading its state so concurrent buyers serialize.
      await tx.$queryRaw`SELECT id FROM bazar_listings WHERE id = ${listingId} FOR UPDATE`

      const listing = await tx.bazarListing.findUnique({
        where: { id: listingId },
        include: {
          heroItem: { include: { item: true } },
          seller: { select: { userId: true } },
        },
      })

      if (!listing || listing.status !== "active") {
        return { error: "Listing no activo", status: 404 }
      }
      if (listing.expiresAt <= new Date()) {
        return { error: "La publicación ha expirado", status: 400 }
      }
      if (listing.sellerId === buyerId) {
        return { error: "No podés comprar tu propio item", status: 400 }
      }

      const price = listing.listingType === "fixed"
        ? listing.price
        : listing.buyNowPrice ?? listing.price

      const previousBid = listing.listingType === "auction"
        ? await tx.bazarPurchase.findFirst({
            where: { listingId: listing.id, cycle: listing.cycle },
            orderBy: [{ pricePaid: "desc" }, { purchasedAt: "desc" }],
          })
        : null

      // Lock buyer, seller and previous bidder wallets before any refund or debit.
      const walletIds = [...new Set([buyerId, listing.sellerId, ...(previousBid ? [previousBid.buyerId] : [])])].sort()
      await tx.$queryRaw`SELECT id FROM heroes WHERE id = ANY(${walletIds}::text[]) ORDER BY id FOR UPDATE`

      if (listing.listingType === "auction" && previousBid && previousBid.buyerId !== buyerId) {
        await tx.hero.update({
          where: { id: previousBid.buyerId },
          data: { gold: { increment: previousBid.pricePaid } },
        })
      }
      const charge = listing.listingType === "auction" && previousBid?.buyerId === buyerId
        ? Math.max(0, price - previousBid.pricePaid)
        : price
      if (charge > 0) {
        const debit = await tx.hero.updateMany({
          where: { id: buyerId, gold: { gte: charge } },
          data: { gold: { decrement: charge } },
        })
        if (debit.count !== 1) throw new Error("INSUFFICIENT_GOLD")
      }

      const itemTransfer = await tx.heroItem.updateMany({
        where: { id: listing.heroItemId, heroId: listing.sellerId, equipped: false },
        data: { heroId: buyerId, equipped: false, slot: null },
      })
      if (itemTransfer.count !== 1) throw new Error("ITEM_TRANSFER_FAILED")

      const closed = await tx.bazarListing.updateMany({
        where: { id: listing.id, status: "active" },
        data: { status: "sold" },
      })
      if (closed.count !== 1) throw new Error("LISTING_ALREADY_CLOSED")

      await tx.hero.update({
        where: { id: listing.sellerId },
        data: { gold: { increment: price } },
      })

      await tx.bazarPurchase.create({
        data: { listingId: listing.id, buyerId, pricePaid: price, cycle: listing.cycle },
      })

      return {
        success: true,
        pricePaid: price,
        itemName: listing.heroItem.item.name,
        sellerId: listing.sellerId,
        buyerId,
        buyerUserId: authResult.hero.userId,
        sellerUserId: listing.seller.userId,
        autoSold: true,
      }
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : ""
    if (code === "INSUFFICIENT_GOLD") {
      return NextResponse.json({ error: "No tenés suficiente oro" }, { status: 400 })
    }
    if (code === "ITEM_TRANSFER_FAILED" || code === "LISTING_ALREADY_CLOSED") {
      return NextResponse.json({ error: "La publicación cambió durante la operación. Actualizá el bazar." }, { status: 409 })
    }
    throw error
  }

  if (isError(result)) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  sendSaleNotifications(result)
  return NextResponse.json({ success: true, pricePaid: result.pricePaid })
}
