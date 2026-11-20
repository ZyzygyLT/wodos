import db from '@/lib/db'
import { updateQuestProgress } from '@/lib/quests/progress'
import { checkAchievements } from '@/lib/achievements/checker'
import { notify } from '@/lib/notifications/emitter'
import logger from '@/lib/logger'

const MAX_LEVEL = 10
const SUCCESS_RATES = [1, 1, 0.9, 0.8, 0.7, 0.5, 0.4, 0.3, 0.2, 0.1]
const GOLD_COST = (level: number) => 100 + level * 50
const ESSENCE_MATERIAL_ID = 6
const ESSENCE_COST = (level: number) => 1 + Math.floor(level / 2)

export interface EnchantResult {
  success: boolean
  currentLevel?: number
  newLevel?: number
  newMax?: number
}

export async function processEnchant(userId: string, heroItemId: string): Promise<{ ok: boolean; error?: string; status?: number; data?: EnchantResult }> {
  const hero = await db.hero.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: { items: { include: { item: true } }, materials: true },
  })
  if (!hero) return { ok: false, error: 'Héroe no encontrado', status: 404 }

  const hi = hero.items.find(i => i.id === heroItemId)
  if (!hi) return { ok: false, error: 'Item no encontrado', status: 404 }

  const currentLevel = hi.upgradeLevel ?? 0
  if (currentLevel >= MAX_LEVEL) return { ok: false, error: 'El item ya está al máximo nivel', status: 400 }

  const goldCost = GOLD_COST(currentLevel)
  const essenceCost = ESSENCE_COST(currentLevel)

  if (hero.gold < goldCost) return { ok: false, error: `Oro insuficiente. Necesitás ${goldCost}💰`, status: 400 }

  const mat = hero.materials.find(m => m.materialId === ESSENCE_MATERIAL_ID)
  if (!mat || mat.quantity < essenceCost) return { ok: false, error: `Faltan ${essenceCost} Esencia Mágica`, status: 400 }

  const successRate = SUCCESS_RATES[currentLevel] ?? 0.05
  const success = Math.random() < successRate

  const newLevel = success ? currentLevel + 1 : currentLevel
  try {
    await db.$transaction(async tx => {
      if (success) {
        // Claim this exact upgrade level first. Concurrent requests for the same
        // item cannot both advance it or charge for the same transition.
        const claimed = await tx.heroItem.updateMany({
          where: { id: hi.id, heroId: hero.id, upgradeLevel: currentLevel },
          data: { upgradeLevel: newLevel },
        })
        if (claimed.count !== 1) throw new Error("ENCHANT_STALE_LEVEL")
      }

      const goldUpdate = await tx.hero.updateMany({
        where: { id: hero.id, gold: { gte: goldCost } },
        data: { gold: { decrement: goldCost } },
      })
      if (goldUpdate.count !== 1) throw new Error("ENCHANT_INSUFFICIENT_GOLD")

      const materialUpdate = await tx.heroMaterial.updateMany({
        where: {
          heroId: hero.id,
          materialId: ESSENCE_MATERIAL_ID,
          quantity: { gte: essenceCost },
        },
        data: { quantity: { decrement: essenceCost } },
      })
      if (materialUpdate.count !== 1) throw new Error("ENCHANT_INSUFFICIENT_ESSENCE")
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ENCHANT_STALE_LEVEL") {
        return { ok: false, error: "El item cambió mientras se procesaba la mejora. Actualizá el inventario e intentá de nuevo.", status: 409 }
      }
      if (error.message === "ENCHANT_INSUFFICIENT_GOLD") {
        return { ok: false, error: `Oro insuficiente. Necesitás ${goldCost}💰`, status: 400 }
      }
      if (error.message === "ENCHANT_INSUFFICIENT_ESSENCE") {
        return { ok: false, error: `Faltan ${essenceCost} Esencia Mágica`, status: 400 }
      }
    }
    throw error
  }

  if (success) {
    updateQuestProgress(hero.id, { type: 'enchant_item' }).catch(e => logger.error("enchant", "Background operation failed", e))
    checkAchievements(hero.id, { type: 'enchant_level' }).catch(e => logger.error("enchant", "Background operation failed", e))
    notify({
      heroId: hero.id,
      type: "enchant_success",
      title: "✨ ¡Mejora exitosa!",
      body: `${hi.item.name} mejorado a +${newLevel}`,
      data: { heroItemId: hi.id, itemName: hi.item.name, newLevel },
    }).catch(e => logger.error("enchant", "Background operation failed", e))
    return { ok: true, data: { success: true, newLevel, newMax: MAX_LEVEL } }
  }

  notify({
    heroId: hero.id,
    type: "enchant_fail",
    title: "💔 Mejora fallida",
    body: `${hi.item.name} no mejoró. Los materiales se perdieron.`,
    data: { heroItemId: hi.id, itemName: hi.item.name, currentLevel },
  }).catch(e => logger.error("enchant", "Background operation failed", e))

  return { ok: true, data: { success: false, currentLevel } }
}
