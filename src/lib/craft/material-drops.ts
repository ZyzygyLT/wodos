import db from "@/lib/db"

const RUNE_DROPS: Record<number, Array<{ slug: string; chance: number }>> = {
  4:  [{ slug: "runa-fuego", chance: 0.05 }],
  6:  [{ slug: "runa-fuego", chance: 0.08 }, { slug: "runa-hielo", chance: 0.05 }],
  7:  [{ slug: "runa-hielo", chance: 0.08 }, { slug: "runa-zafiro", chance: 0.04 }],
  8:  [{ slug: "runa-zafiro", chance: 0.08 }, { slug: "runa-rubi", chance: 0.05 }, { slug: "runa-esmeralda", chance: 0.03 }],
  9:  [{ slug: "runa-rubi", chance: 0.08 }, { slug: "runa-esmeralda", chance: 0.05 }],
  10: [{ slug: "runa-esmeralda", chance: 0.08 }, { slug: "runa-vacio", chance: 0.03 }],
}

const MATERIAL_DROPS: Record<number, Array<{ materialId: number; chance: number; minQty: number; maxQty: number }>> = {
  1: [ // Cueva de Arañas
    { materialId: 1, chance: 0.6, minQty: 2, maxQty: 4 },
    { materialId: 2, chance: 0.3, minQty: 1, maxQty: 3 },
    { materialId: 4, chance: 0.2, minQty: 1, maxQty: 2 },
  ],
  2: [ // Bosque Susurrante
    { materialId: 1, chance: 0.5, minQty: 1, maxQty: 3 },
    { materialId: 3, chance: 0.4, minQty: 1, maxQty: 2 },
  ],
  3: [ // Ruinas Abandonadas
    { materialId: 2, chance: 0.5, minQty: 1, maxQty: 3 },
    { materialId: 8, chance: 0.4, minQty: 2, maxQty: 4 },
  ],
  4: [ // Templo del Sol
    { materialId: 2, chance: 0.4, minQty: 1, maxQty: 3 },
    { materialId: 5, chance: 0.3, minQty: 1, maxQty: 2 },
    { materialId: 6, chance: 0.1, minQty: 1, maxQty: 1 },
  ],
  5: [ // Ciénaga Profunda
    { materialId: 1, chance: 0.4, minQty: 1, maxQty: 2 },
    { materialId: 3, chance: 0.5, minQty: 2, maxQty: 4 },
  ],
  6: [ // Guarida de la Sierpe
    { materialId: 3, chance: 0.3, minQty: 1, maxQty: 2 },
    { materialId: 4, chance: 0.4, minQty: 1, maxQty: 3 },
    { materialId: 7, chance: 0.15, minQty: 1, maxQty: 1 },
  ],
  7: [ // Fortaleza Carmesí
    { materialId: 2, chance: 0.3, minQty: 1, maxQty: 3 },
    { materialId: 8, chance: 0.5, minQty: 2, maxQty: 5 },
    { materialId: 5, chance: 0.2, minQty: 1, maxQty: 2 },
  ],
  8: [ // Pico del Dragón
    { materialId: 7, chance: 0.4, minQty: 1, maxQty: 2 },
    { materialId: 5, chance: 0.3, minQty: 1, maxQty: 2 },
    { materialId: 6, chance: 0.2, minQty: 1, maxQty: 2 },
  ],
  9: [ // Abismo del Vacío
    { materialId: 6, chance: 0.4, minQty: 1, maxQty: 3 },
    { materialId: 8, chance: 0.3, minQty: 1, maxQty: 2 },
  ],
  10: [ // Santuario Olvidado
    { materialId: 5, chance: 0.4, minQty: 1, maxQty: 3 },
    { materialId: 6, chance: 0.4, minQty: 1, maxQty: 3 },
    { materialId: 7, chance: 0.2, minQty: 1, maxQty: 2 },
  ],
}

export async function grantMaterialDrops(heroId: string, dungeonId: number, runId: string) {
  const drops = MATERIAL_DROPS[dungeonId]
  if (!drops || !runId) return

  try {
    await db.$transaction(async tx => {
      // A unique (run, hero, kind) claim makes retries and duplicate workers harmless.
      await tx.dungeonRunRewardGrant.create({
        data: { runId, heroId, kind: "material_and_rune_drops" },
      })

      const granted = rollMaterialDrops(drops)
      for (const g of granted) {
        await tx.heroMaterial.upsert({
          where: { heroId_materialId: { heroId, materialId: g.materialId } },
          update: { quantity: { increment: g.quantity } },
          create: { heroId, materialId: g.materialId, quantity: g.quantity },
        })
      }

      const runeDrops = RUNE_DROPS[dungeonId] ?? []
      if (runeDrops.length > 0) {
        const runeItems = await tx.item.findMany({
          where: { slug: { in: runeDrops.map(r => r.slug) } },
          select: { id: true, slug: true },
        })
        const runeMap = new Map(runeItems.map(r => [r.slug, r.id]))
        for (const rd of runeDrops) {
          if (Math.random() >= rd.chance) continue
          const itemId = runeMap.get(rd.slug)
          if (itemId) await tx.heroItem.create({ data: { heroId, itemId, equipped: false } })
        }
      }
    })
    return true
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return false
    }
    throw error
  }
}

function rollMaterialDrops(drops: Array<{ materialId: number; chance: number; minQty: number; maxQty: number }>) {
  const granted: { materialId: number; quantity: number }[] = []
  for (const drop of drops) {
    if (Math.random() < drop.chance) {
      const qty = drop.minQty + Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1))
      granted.push({ materialId: drop.materialId, quantity: qty })
    }
  }
  return granted
}
