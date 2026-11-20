import db from "@/lib/db"
import logger from "@/lib/logger"
import { notify } from "@/lib/notifications/emitter"
import { trackItemPurchased } from "@/lib/analytics/events"

type SettlementResult =
  | { kind: "expired"; listingId: string }
  | {
      kind: "sold"
      listingId: string
      buyerId: string
      buyerUserId: string
      sellerId: string
      sellerUserId: string
      itemName: string
      price: number
    }
  | { kind: "skipped"; listingId: string }

let interval: ReturnType<typeof setInterval> | null = null
let running = false

async function settleListing(listingId: string, now: Date): Promise<SettlementResult> {
  return db.$transaction(async tx => {
    // A row lock makes settlement idempotent across overlapping cron processes.
    await tx.$queryRaw`SELECT id FROM bazar_listings WHERE id = ${listingId} FOR UPDATE`

    const listing = await tx.bazarListing.findUnique({
      where: { id: listingId },
      include: {
        heroItem: { include: { item: true } },
        seller: { select: { id: true, userId: true } },
      },
    })

    if (!listing || listing.status !== "active" || listing.expiresAt > now) {
      return { kind: "skipped", listingId }
    }

    const winningBid = listing.listingType === "auction"
      ? await tx.bazarPurchase.findFirst({
          where: { listingId: listing.id, cycle: listing.cycle },
          orderBy: [{ pricePaid: "desc" }, { purchasedAt: "desc" }],
          include: { buyer: { select: { id: true, userId: true } } },
        })
      : null

    if (!winningBid) {
      const expired = await tx.bazarListing.updateMany({
        where: { id: listing.id, status: "active", expiresAt: { lte: now } },
        data: { status: "expired" },
      })
      return expired.count === 1
        ? { kind: "expired", listingId }
        : { kind: "skipped", listingId }
    }

    // The winning bid is already escrowed. Lock both wallets before settlement.
    const walletIds = [listing.sellerId, winningBid.buyerId].sort()
    await tx.$queryRaw`SELECT id FROM heroes WHERE id = ANY(${walletIds}::text[]) ORDER BY id FOR UPDATE`

    const transfer = await tx.heroItem.updateMany({
      where: { id: listing.heroItemId, heroId: listing.sellerId, equipped: false },
      data: { heroId: winningBid.buyerId, equipped: false },
    })
    if (transfer.count !== 1) {
      throw new Error(`BAZAR_SETTLEMENT_ITEM_TRANSFER_FAILED:${listing.id}`)
    }

    const closed = await tx.bazarListing.updateMany({
      where: { id: listing.id, status: "active", expiresAt: { lte: now } },
      data: { status: "sold" },
    })
    if (closed.count !== 1) {
      throw new Error(`BAZAR_SETTLEMENT_LISTING_STATE_CHANGED:${listing.id}`)
    }

    await tx.hero.update({
      where: { id: listing.sellerId },
      data: { gold: { increment: winningBid.pricePaid } },
    })

    return {
      kind: "sold",
      listingId,
      buyerId: winningBid.buyerId,
      buyerUserId: winningBid.buyer.userId,
      sellerId: listing.sellerId,
      sellerUserId: listing.seller.userId,
      itemName: listing.heroItem.item.name,
      price: winningBid.pricePaid,
    }
  })
}

function notifySettlement(result: Extract<SettlementResult, { kind: "sold" }>) {
  trackItemPurchased(result.buyerUserId, {
    itemName: result.itemName,
    price: result.price,
  })

  notify({
    heroId: result.buyerId,
    type: "auction_won",
    title: "🏆 Ganaste la subasta",
    body: `Ganaste "${result.itemName}" por ${result.price}💰. El objeto ya está en tu inventario.`,
  }).catch(error => logger.error("bazar-cron", "Winner notification failed", error))

  notify({
    heroId: result.sellerId,
    type: "item_sold",
    title: "💰 Subasta finalizada",
    body: `Vendiste "${result.itemName}" por ${result.price}💰.`,
  }).catch(error => logger.error("bazar-cron", "Seller notification failed", error))
}

export async function tickBazarAuctions() {
  if (running) return
  running = true

  try {
    const now = new Date()
    const expiredListings = await db.bazarListing.findMany({
      where: { status: "active", expiresAt: { lte: now } },
      select: { id: true },
      orderBy: { expiresAt: "asc" },
      take: 100,
    })

    for (const listing of expiredListings) {
      try {
        const result = await settleListing(listing.id, now)
        if (result.kind === "sold") notifySettlement(result)
      } catch (error) {
        logger.error("bazar-cron", `Failed to settle listing ${listing.id}`, error)
      }
    }
  } catch (error) {
    logger.error("bazar-cron", "Error processing expired bazar listings", error)
  } finally {
    running = false
  }
}

export function startBazarCron() {
  if (interval) return
  logger.info("bazar-cron", "Iniciado — revisa publicaciones vencidas cada minuto")
  tickBazarAuctions()
  interval = setInterval(() => {
    tickBazarAuctions()
  }, 60_000)
}

export function stopBazarCron() {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}
