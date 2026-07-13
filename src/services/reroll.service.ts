import db from '@/lib/db'
import { updateQuestProgress } from '@/lib/quests/progress'
import { checkAchievements } from '@/lib/achievements/checker'
import logger from '@/lib/logger'

const STAT_RANGES: Record<string, { min: number; max: number }> = {
  str: { min: 1, max: 8 }, agi: { min: 1, max: 8 }, int: { min: 1, max: 8 },
  wis: { min: 1, max: 8 }, con: { min: 1, max: 8 }, cha: { min: 1, max: 8 },
  hp: { min: 5, max: 30 }, mp: { min: 3, max: 20 }, armor: { min: 2, max: 15 },
  fireResist: { min: 1, max: 12 }, iceResist: { min: 1, max: 12 }, poisonResist: { min: 1, max: 12 },
  atk: { min: 2, max: 12 }, dx: { min: 1, max: 6 }, co: { min: 1, max: 6 },
}

const ESSENCE_MATERIAL_ID = 6
const GEM_MATERIAL_ID = 5
const GOLD_COST = 80

export interface RerollResult {
  statKey: string
  oldValue: number
  newValue: number
}

export async function processReroll(
  userId: string,
  heroItemId: string,
  statKey: string,
): Promise<{ ok: boolean; error?: string; status?: number; data?: RerollResult }> {
  const hero = await db.hero.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
    include: {
      items: { include: { item: true } },
      materials: true,
    },
  })
  if (!hero) return { ok: false, error: 'Héroe no encontrado', status: 404 }

  const hi = hero.items.find(i => i.id === heroItemId)
  if (!hi) return { ok: false, error: 'Item no encontrado', status: 404 }

  const baseStats = (hi.item.stats ?? {}) as Record<string, number>
  const overrides = (hi.statOverrides ?? {}) as Record<string, number>
  const effectiveStats = { ...baseStats, ...overrides }

  if (!(statKey in effectiveStats)) return { ok: false, error: `El item no tiene stat "${statKey}"`, status: 400 }

  if (hero.gold < GOLD_COST) {
    return { ok: false, error: `Oro insuficiente. Necesitás ${GOLD_COST}💰`, status: 400 }
  }

  const essence = hero.materials.find(m => m.materialId === ESSENCE_MATERIAL_ID)
  if (!essence || essence.quantity < 2) {
    return { ok: false, error: 'Faltan 2 Esencia Mágica', status: 400 }
  }

  const gems = hero.materials.find(m => m.materialId === GEM_MATERIAL_ID)
  if (!gems || gems.quantity < 1) {
    return { ok: false, error: 'Falta 1 Fragmento de Gema', status: 400 }
  }

  const range = STAT_RANGES[statKey] ?? { min: 1, max: 10 }
  const oldValue = effectiveStats[statKey]
  let newValue: number
  do {
    newValue = range.min + Math.floor(Math.random() * (range.max - range.min + 1))
  } while (newValue === oldValue && range.min !== range.max)

  const newOverrides = { ...overrides, [statKey]: newValue }

  await db.$transaction([
    db.heroItem.update({
      where: { id: hi.id },
      data: { statOverrides: newOverrides },
    }),
    db.hero.update({ where: { id: hero.id }, data: { gold: { decrement: GOLD_COST } } }),
    db.heroMaterial.update({
      where: { heroId_materialId: { heroId: hero.id, materialId: ESSENCE_MATERIAL_ID } },
      data: { quantity: { decrement: 2 } },
    }),
    db.heroMaterial.update({
      where: { heroId_materialId: { heroId: hero.id, materialId: GEM_MATERIAL_ID } },
      data: { quantity: { decrement: 1 } },
    }),
  ])

  updateQuestProgress(hero.id, { type: 'craft_items' }).catch(e => logger.error('reroll', 'Failed to update quest progress for craft_items', e))
  checkAchievements(hero.id, { type: 'craft_items' }).catch(e => logger.error('reroll', 'Failed to check achievements for craft_items', e))

  return { ok: true, data: { statKey, oldValue, newValue } }
}
