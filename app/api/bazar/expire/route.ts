import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const expired = await db.bazarListing.findMany({
    where: {
      status: "active",
      expiresAt: { lte: new Date() },
      listingType: "auction",
    },
    include: {
      purchases: { orderBy: { pricePaid: "desc" }, take: 1 },
    },
  })

  let processed = 0
  for (const listing of expired) {
    const winner = listing.purchases[0]
    if (winner) {
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
          where: { id: listing.id },
          data: { status: "sold" },
        }),
      ])
    } else {
      await db.bazarListing.update({
        where: { id: listing.id },
        data: { status: "expired" },
      })
    }
    processed++
  }

  return NextResponse.json({ processed })
}
