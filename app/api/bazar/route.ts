import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { checkRateLimit, ipKey } from "@/lib/rate-limit"
import { listItem } from "@/services/bazar.service"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"

export async function GET() {
  const listings = await db.bazarListing.findMany({
    where: { status: "active" },
    include: {
      seller: { select: { id: true, name: true } },
      item: { select: { name: true, icon: true, rarity: true, category: true } },
      heroItem: { select: { runesIn: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const listingsWithCurrentBids = await Promise.all(listings.map(async listing => ({
    ...listing,
    purchases: await db.bazarPurchase.findMany({
      where: { listingId: listing.id, cycle: listing.cycle },
      orderBy: { pricePaid: "desc" },
      take: 1,
    }),
  })))

  return NextResponse.json(listingsWithCurrentBids)
}

const schema = z.object({
  heroItemId: z.string().min(1),
  price: z.number().int().positive(),
  listingType: z.enum(["fixed", "auction"]).default("fixed"),
  expiresInHours: z.number().int().positive().optional(),
})

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`bazar:${ipKey(req)}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: "Demasiadas peticiones. Intentá de nuevo en un minuto." }, { status: 429 })
  }

  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })

  const result = await listItem(session.user.id, parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status ?? 400 })

  return NextResponse.json(result.data)
}


export async function DELETE(req: NextRequest) {
  const rl = checkRateLimit(`bazar-cancel:${ipKey(req)}`, 10, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: "Demasiadas peticiones. Intentá de nuevo en un minuto." }, { status: 429 })
  }

  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  let body: { listingId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 })
  }

  const listingId = typeof body.listingId === "string" ? body.listingId : ""
  if (!listingId) return NextResponse.json({ error: "Falta listingId" }, { status: 400 })

  const seller = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (!seller) return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })

  try {
    const result = await db.$transaction(async tx => {
      // Serialize cancellation against bids, buy-now and expiry settlement.
      await tx.$queryRaw`SELECT id FROM bazar_listings WHERE id = ${listingId} FOR UPDATE`

      const listing = await tx.bazarListing.findUnique({
        where: { id: listingId },
        select: { id: true, sellerId: true, listingType: true, cycle: true, status: true, expiresAt: true },
      })

      if (!listing || listing.sellerId !== seller.id) {
        return { error: "Publicación no encontrada" as const, status: 404 }
      }
      if (listing.status !== "active") {
        return { error: "La publicación ya no está activa" as const, status: 409 }
      }
      if (listing.expiresAt <= new Date()) {
        return { error: "La publicación ya venció y debe liquidarse" as const, status: 409 }
      }

      const leadingBid = listing.listingType === "auction"
        ? await tx.bazarPurchase.findFirst({
            where: { listingId: listing.id, cycle: listing.cycle },
            orderBy: [{ pricePaid: "desc" }, { purchasedAt: "desc" }],
            select: { buyerId: true, pricePaid: true },
          })
        : null

      const walletIds = [...new Set([seller.id, ...(leadingBid ? [leadingBid.buyerId] : [])])].sort()
      await tx.$queryRaw`SELECT id FROM heroes WHERE id = ANY(${walletIds}::text[]) ORDER BY id FOR UPDATE`

      const cancelled = await tx.bazarListing.updateMany({
        where: { id: listing.id, sellerId: seller.id, status: "active", expiresAt: { gt: new Date() } },
        data: { status: "cancelled" },
      })
      if (cancelled.count !== 1) {
        return { error: "La publicación cambió durante la cancelación" as const, status: 409 }
      }

      if (leadingBid) {
        const refund = await tx.hero.updateMany({
          where: { id: leadingBid.buyerId },
          data: { gold: { increment: leadingBid.pricePaid } },
        })
        if (refund.count !== 1) throw new Error("BAZAR_CANCEL_REFUND_FAILED")
      }

      return { success: true as const, refundedHeroId: leadingBid?.buyerId, refundedGold: leadingBid?.pricePaid ?? 0 }
    })

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    return NextResponse.json({
      success: true,
      refundedGold: result.refundedGold,
      refunded: result.refundedGold > 0,
    })
  } catch (error) {
    if (error instanceof Error && error.message === "BAZAR_CANCEL_REFUND_FAILED") {
      return NextResponse.json({ error: "No se pudo devolver el depósito. La cancelación fue revertida." }, { status: 409 })
    }
    throw error
  }
}
