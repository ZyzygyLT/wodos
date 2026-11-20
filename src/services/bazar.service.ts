import db from '@/lib/db'
import { trackItemListed } from '@/lib/analytics/events'
import type { ListingType } from '@/generated/prisma'

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
    select: { id: true },
  })
  if (!hero) return { ok: false, error: 'No tenés un héroe', status: 404 }

  const expiresAt = new Date(Date.now() + (params.expiresInHours ?? 72) * 3600000)
  const listingType = params.listingType

  try {
    const result = await db.$transaction(async tx => {
      // Serialize attempts to list the same owned item, then validate fresh state.
      await tx.$queryRaw`SELECT id FROM hero_items WHERE id = ${params.heroItemId} FOR UPDATE`

      const heroItem = await tx.heroItem.findFirst({
        where: { id: params.heroItemId, heroId: hero.id },
        include: { item: true },
      })
      if (!heroItem) throw new Error('ITEM_NOT_FOUND')
      if (heroItem.equipped) throw new Error('ITEM_EQUIPPED')

      const existing = await tx.bazarListing.findUnique({
        where: { heroItemId: heroItem.id },
      })
      if (existing?.status === 'active') throw new Error('ALREADY_LISTED')

      const listingData = {
        sellerId: hero.id,
        itemId: heroItem.itemId,
        listingType,
        price: params.price,
        startPrice: listingType === 'auction' ? params.price : null,
        buyNowPrice: listingType === 'auction' ? Math.round(params.price * 1.5) : null,
        expiresAt,
        status: 'active' as const,
        cycle: existing ? existing.cycle + 1 : 1,
      }

      const listing = existing
        ? await tx.bazarListing.update({
            where: { id: existing.id },
            data: listingData,
          })
        : await tx.bazarListing.create({
            data: { ...listingData, heroItemId: heroItem.id },
          })

      return { listing, itemName: heroItem.item.name }
    })

    trackItemListed(userId, {
      itemName: result.itemName,
      price: params.price,
      type: listingType,
    })

    return { ok: true, data: result.listing }
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (code === 'ITEM_NOT_FOUND') return { ok: false, error: 'Item no encontrado', status: 404 }
    if (code === 'ITEM_EQUIPPED') return { ok: false, error: 'Deequipá el item antes de venderlo', status: 400 }
    if (code === 'ALREADY_LISTED') return { ok: false, error: 'Este item ya está en venta', status: 400 }
    throw error
  }
}
