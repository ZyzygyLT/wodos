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
      seller: { select: { name: true } },
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
