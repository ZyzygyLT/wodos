import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const pool = new pg.Pool({
  host: '127.0.0.1',
  port: 5432,
  user: 'postgres',
  password: '1234',
  database: 'ironhold',
})
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

async function main() {
  await seedClasses()
  await seedRaces()
  const classMap = await seedSkills()
  await seedDefenseSkills(classMap)
  await seedEnemySkills()
  const { skillBySlug, raceMap2 } = await seedShopItems(classMap)
  const itemSlugMap = await seedItemConfig()
  const _i = (slug: string) => itemSlugMap[slug] ?? 999
  await seedRuneItems()
  await seedEarlyDungeons(itemSlugMap)
  await seedInitialEnemies()
  await seedLateGameEnemies()
  await seedTrapEnemies()
  await assignEnemyDefenseSkills2(skillBySlug)
  await assignEnemyOffensiveSkills(skillBySlug)
  await seedMoreDungeons(itemSlugMap)
  await seedMaterials()
  await seedCraftableItems()
  await seedWeeklyEvents()
  await seedQuests(itemSlugMap)
  await seedAchievements()
  await seedAdminUser()
  await seedAttributeDefinitions()
  await seedForumCategories()
  await seedFactions()
  await seedFactionShops()
console.log('✅ Seed completado')
}

async function assignEnemyDefenseSkills(allEnemies: any[], overrides: Record<number, string[]>, posMap: Record<string, string>, skillBySlug: Record<string, number>) {
  for (const e of allEnemies) {
    if (e.level < 3) continue
    const override = overrides[e.id]
    const ids: number[] = override
      ? override.map(slug => skillBySlug[slug]).filter(Boolean)
      : []
    if (override && ids.length > 0) {
      await db.enemy.update({ where: { id: e.id }, data: { skillIds: ids } })
      continue
    }
    const pos = e.position as string
    const posSkill = posMap[pos]
    if (e.level >= 5) {
      ids.push(skillBySlug['esquivar-golpe'], skillBySlug['esquivar-proyectil'], skillBySlug['esquivar-magia'])
    } else if (posSkill && skillBySlug[posSkill]) {
      ids.push(skillBySlug[posSkill])
    }
    if (ids.length > 0) {
      await db.enemy.update({ where: { id: e.id }, data: { skillIds: ids } })
    }
  }
}

async function assignEnemyOffensiveSkills(skillBySlug: Record<string, number>) {
  const enemyOffSkills: Record<number, string[]> = {
    1: [], 2: ['escupir-veneno'], 3: ['escupir-veneno', 'vendaje-rapido'],
    4: ['golpe-basico'], 5: ['disparo-rapido'], 6: ['golpe-basico'],
    7: ['toque-espectral'], 8: ['golpe-basico'],
    9: ['bola-fuego', 'meteoro'], 10: [],
    11: ['bola-fuego', 'meteoro', 'grito-guerra'],
    12: ['rayo', 'meteoro', 'toque-mana'], 13: ['fragmento-hielo'],
  }
  const allEnemies = await db.enemy.findMany()
  for (const e of allEnemies) {
    const offSlugs = enemyOffSkills[e.id]
    if (!offSlugs || offSlugs.length === 0) continue
    const offIds = offSlugs.map(slug => skillBySlug[slug]).filter(Boolean)
    const combined = [...new Set([...(e.skillIds ?? []), ...offIds])]
    if (combined.length !== (e.skillIds ?? []).length) {
      await db.enemy.update({ where: { id: e.id }, data: { skillIds: combined } })
    }
  }
}

async function seedCraftableItems() {
  const craftables = [
    {
      slug: "escudo-madera",
      data: {
        name: "Escudo de Madera Reforzado", icon: "🛡️",
        category: "armor" as const, rarity: "uncommon" as const,
        description: "Escudo de madera reforzado con hierro.",
        stats: { co: 4, dx: 1 }, levelReq: 2, price: 120,
        isCraftable: true,
        recipe: { materials: [{ materialId: 1, quantity: 5 }, { materialId: 2, quantity: 3 }], goldCost: 50 },
      },
    },
    {
      slug: "baston-arcano",
      data: {
        name: "Bastón Arcano", icon: "🪄",
        category: "weapon" as const, rarity: "uncommon" as const,
        description: "Bastón imbuido con esencia mágica.",
        stats: { in: 5, wi: 2 }, classReq: [], levelReq: 3, price: 200,
        isCraftable: true,
        recipe: { materials: [{ materialId: 4, quantity: 3 }, { materialId: 5, quantity: 2 }, { materialId: 6, quantity: 1 }], goldCost: 80 },
      },
    },
    {
      slug: "armadura-cuero-mejorada",
      data: {
        name: "Armadura de Cuero Mejorada", icon: "🧥",
        category: "armor" as const, rarity: "rare" as const,
        description: "Armadura de cuero reforzada con escamas de dragón.",
        stats: { co: 6, ag: 2, dx: 2, armor: 10, fireResist: 8 },
        levelReq: 5, price: 350,
        isCraftable: true,
        recipe: { materials: [{ materialId: 3, quantity: 5 }, { materialId: 7, quantity: 2 }, { materialId: 8, quantity: 4 }], goldCost: 150 },
      },
    },
  ]
  for (const c of craftables) {
    await db.item.upsert({
      where: { slug: c.slug },
      update: {},
      create: { ...c.data, classReq: (c.data as any).classReq ?? [], slug: c.slug },
    })
  }
}

main().catch(console.error).finally(() => db.$disconnect())
