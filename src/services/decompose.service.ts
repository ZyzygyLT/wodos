import db from '@/lib/db'
import { updateQuestProgress } from '@/lib/quests/progress'
import { checkAchievements } from "@/lib/achievements/checker"
import logger from '@/lib/logger'

const RARITY_MATERIAL_MAP: Record<string, { materialId: number; minQty: number; maxQty: number }[]> = {
  common:    [{ materialId: 8, minQty: 1, maxQty: 3 }],
  uncommon:  [{ materialId: 1, minQty: 2, maxQty: 4 }, { materialId: 3, minQty: 1, maxQty: 2 }],
  rare:      [{ materialId: 2, minQty: 3, maxQty: 5 }, { materialId: 4, minQty: 2, maxQty: 3 }],
  epic:      [{ materialId: 5, minQty: 3, maxQty: 5 }, { materialId: 6, minQty: 1, maxQty: 3 }],
  legendary: [{ materialId: 6, minQty: 4, maxQty: 6 }, { materialId: 7, minQty: 2, maxQty: 4 }],
}

const GOLD_BY_RARITY: Record<string, number> = {
  common: 10, uncommon: 25, rare: 50, epic: 100, legendary: 250,
}

export interface DecomposeResult {
  materials: { name: string; icon: string; quantity: number }[]
  gold: number
}

export async function processDecompose(
  userId: string,
  heroItemId: string,
): Promise<{ ok: boolean; error?: string; status?: number; data?: DecomposeResult }> {
  const hero = await db.hero.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      items: { include: { item: true } },
      materials: { include: { material: true } },
    },
  })
  if (!hero) return { ok: false, error: 'Héroe no encontrado', status: 404 }

  const hi = hero.items.find(i => i.id === heroItemId)
  if (!hi) return { ok: false, error: 'Item no encontrado', status: 404 }

  const matDrops = RARITY_MATERIAL_MAP[hi.item.rarity] ?? RARITY_MATERIAL_MAP.common
  const goldReward = GOLD_BY_RARITY[hi.item.rarity] ?? 10

  const granted: { name: string; icon: string; quantity: number }[] = []

  await db.$transaction(async (tx) => {
    for (const drop of matDrops) {
      const qty = drop.minQty + Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1))
      await tx.heroMaterial.upsert({
        where: { heroId_materialId: { heroId: hero.id, materialId: drop.materialId } },
        update: { quantity: { increment: qty } },
        create: { heroId: hero.id, materialId: drop.materialId, quantity: qty },
      })
      const mat = hero.materials.find(m => m.materialId === drop.materialId)?.material
      granted.push({ name: mat?.name ?? `Material #${drop.materialId}`, icon: mat?.icon ?? '📦', quantity: qty })
    }

    await tx.hero.update({
      where: { id: hero.id },
      data: { gold: { increment: goldReward } },
    })

    await tx.heroItem.delete({ where: { id: hi.id } })
  })

  updateQuestProgress(hero.id, { type: 'craft_items' }).catch(e => logger.error("decompose", "Background operation failed", e))
  checkAchievements(hero.id, { type: 'craft_items' }).catch(e => logger.error("decompose", "Background operation failed", e))

  return { ok: true, data: { materials: granted, gold: goldReward } }
}
