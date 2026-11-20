/**
 * Serializes inventory mutations against marketplace publication.
 * Call inside the same transaction as the mutation.
 */
export async function assertHeroItemNotListed(tx: any, heroItemId: string, heroId: string) {
  await tx.$queryRaw`SELECT id FROM hero_items WHERE id = ${heroItemId} FOR UPDATE`

  const item = await tx.heroItem.findFirst({
    where: { id: heroItemId, heroId },
    select: { id: true },
  })
  if (!item) throw new Error("ITEM_NOT_FOUND")

  const activeListing = await tx.bazarListing.findFirst({
    where: { heroItemId, status: "active" },
    select: { id: true },
  })
  if (activeListing) throw new Error("ITEM_LISTED")
}
