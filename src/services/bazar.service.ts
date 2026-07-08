import db from '@/lib/db'
import { trackItemListed } from '@/lib/analytics/events'
import type { ListingType } from '@prisma/client'

export interface ListItemResult {
  id: string
  sellerId: string
  heroItemId: string
  itemId: number
  listingType: ListingType
  price: number
  expiresAt: Date
}

export async function listItem(
  userId: string,
  params: { heroItemId: string; price: number; listingType: ListingType; expiresInHours?: number }
): Promise<{ ok: boolean; error?: string; status?: number; data?: ListItemResult }> {
  const hero = await db.hero.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { items: { include: { item: true } } },
  })
  if (!hero) return { ok: false, error: 'No tenés un héroe', status: 404 }

  const heroItem = hero.items.find(i => i.id === params.heroItemId)
  if (!heroItem) return { ok: false, error: 'Item no encontrado', status: 404 }

  if (heroItem.equipped) return { ok: false, error: 'Deequipá el item antes de venderlo', status: 400 }

  const existing = await db.bazarListing.findUnique({ where: { heroItemId: params.heroItemId } })
  if (existing?.status === 'active') return { ok: false, error: 'Este item ya está en venta', status: 400 }

  const expiresAt = new Date(Date.now() + (params.expiresInHours ?? 72) * 3600000)
  const listingType = params.listingType

  const listing = await db.bazarListing.create({
    data: {
      sellerId: hero.id,
      heroItemId: heroItem.id,
      itemId: heroItem.itemId,
      listingType,
      price: params.price,
      startPrice: listingType === 'auction' ? params.price : null,
      buyNowPrice: listingType === 'auction' ? Math.round(params.price * 1.5) : null,
      expiresAt,
    },
  })

  trackItemListed(userId, {
    itemName: heroItem.item.name,
    price: params.price,
    type: listingType,
  })

  return { ok: true, data: listing }
}
