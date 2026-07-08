import db from "@/lib/db"

interface EnemySlot { id: number; name: string; count: number; pos: string; isBoss?: boolean }
interface LevelData { number: number; enemies: EnemySlot[]; epReward: number; goldReward: number }
interface LootEntry { itemId: number; chance: number; minQty: number; maxQty: number }

const ENEMY_POOLS: Record<number, { enemies: number[]; bosses: number[] }> = {
  5: {
    enemies: [1, 2, 4],
    bosses: [3],
  },
  10: {
    enemies: [4, 5, 7, 8],
    bosses: [6],
  },
  15: {
    enemies: [7, 8, 9, 13],
    bosses: [11, 12],
  },
}

const lootSlugs: Record<number, string[]> = {
  5: ['anillo-proteccion', 'pocion-vida-grande', 'cota-mallas', 'yelmo-acero', 'baston-arcano'],
  10: ['armadura-cuero-mejorada', 'gafas-vision', 'hombreras-acero', 'botas-velocidad', 'pocion-vida-grande'],
  15: ['armadura-cuero-mejorada', 'botas-velocidad', 'anillo-proteccion', 'gafas-vision', 'hombreras-acero'],
}

function dungeonDifficultyLabel(level: number): string {
  if (level >= 15) return '⭐⭐⭐⭐⭐ Leyenda'
  if (level >= 10) return '⭐⭐⭐⭐ Épico'
  return '⭐⭐⭐ Difícil'
}

export async function generateClanDungeon(clanId: string, bonusLevel: number) {
  let level: number
  if (bonusLevel <= 5) level = 5
  else if (bonusLevel <= 10) level = 10
  else level = 15
  const pool = ENEMY_POOLS[level]
  const enemyNames: Record<number, string> = {
    1: 'Araña pequeña', 2: 'Esqueleto andante', 3: 'Araña reina',
    4: 'Guardia esqueleto', 5: 'Banshee', 6: 'Nigromante',
    7: 'Espectro', 8: 'Lobo sombrío', 9: 'Elemental de fuego',
    11: 'Titán de lava', 12: 'Señor oscuro', 13: 'Elemental de hielo',
  }

  const levels: LevelData[] = [
    {
      number: 1,
      enemies: [
        { id: pool.enemies[0], name: enemyNames[pool.enemies[0]], count: 3, pos: 'front' },
        { id: pool.enemies[1] ?? pool.enemies[0], name: enemyNames[pool.enemies[1] ?? pool.enemies[0]], count: 2, pos: 'center' },
      ],
      epReward: 100 + level * 20,
      goldReward: 150 + level * 30,
    },
    {
      number: 2,
      enemies: [
        { id: pool.enemies[2] ?? pool.enemies[0], name: enemyNames[pool.enemies[2] ?? pool.enemies[0]], count: 2, pos: 'front' },
        { id: pool.enemies[1] ?? pool.enemies[0], name: enemyNames[pool.enemies[1] ?? pool.enemies[0]], count: 2, pos: 'center' },
      ],
      epReward: 120 + level * 20,
      goldReward: 180 + level * 30,
    },
    {
      number: 3,
      enemies: [
        { id: pool.bosses[0], name: enemyNames[pool.bosses[0]], count: 1, pos: 'rear', isBoss: true },
        { id: pool.enemies[0], name: enemyNames[pool.enemies[0]], count: 2, pos: 'front' },
      ],
      epReward: 150 + level * 25,
      goldReward: 250 + level * 40,
    },
  ]

  // Resolve loot table item IDs
  const itemSlugs = lootSlugs[level]
  const items = await db.item.findMany({ where: { slug: { in: itemSlugs } }, select: { id: true, slug: true } })
  const slugMap = Object.fromEntries(items.map(i => [i.slug, i.id]))

  const lootTable: LootEntry[] = itemSlugs.map(slug => ({
    itemId: slugMap[slug] ?? 999,
    chance: 0.3,
    minQty: 1,
    maxQty: 1,
  }))

  const clan = await db.clan.findUnique({ where: { id: clanId }, select: { name: true, icon: true } })
  const tag = clan?.name ?? 'Clan'

  return {
    name: `Mazmorra de ${tag}`,
    slug: `clan-dungeon-${clanId}`,
    icon: clan?.icon ?? '🏰',
    region: 'Territorio del clan',
    description: 'Una mazmorra exclusiva del clan. Solo los miembros más fuertes pueden adentrarse en sus profundidades.',
    lore: 'Forjada con el poder del clan, esta mazmorra cambia con cada generación de guerreros.',
    levelReq: Math.max(1, bonusLevel - 3),
    recommendedLevel: bonusLevel,
    difficulty: 3,
    difficultyLabel: dungeonDifficultyLabel(level),
    isInstant: true,
    epReward: 300 + bonusLevel * 30,
    goldReward: 500 + bonusLevel * 50,
    fameReward: 30 + bonusLevel * 5,
    levels: levels as any,
    lootTable: lootTable as any,
  }
}
