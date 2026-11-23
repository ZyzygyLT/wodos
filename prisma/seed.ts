import { Prisma, PrismaClient } from '../src/generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import bcrypt from 'bcryptjs'

function stripNulls<T extends Record<string, unknown>>(obj: T): T {
  const cleaned = { ...obj }
  for (const k of Object.keys(cleaned)) {
    if ((cleaned as any)[k] === null) delete (cleaned as any)[k]
  }
  return cleaned
}

const pool = new pg.Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: process.env.DB_HOST ?? '127.0.0.1',
        port: Number(process.env.DB_PORT ?? '5433'),
        user: process.env.DB_USER ?? 'postgres',
        password: process.env.DB_PASSWORD ?? '',
        database: process.env.DB_NAME ?? 'ironhold',
      }
)
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
  await seedAdventures()
  await seedTestDungeon(itemSlugMap)
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

async function seedClasses() {
  const classes = [
    { name: 'Guerrero', slug: 'guerrero', icon: '⚔️', role: 'tank' as const, position: 'front' as const, difficulty: 'beginner' as const, description: 'Especialista en combate cuerpo a cuerpo. Alta defensa y resistencia.', baseAttrs: { st: 12, co: 10, dx: 6, ag: 4, in: 3, wi: 3, ch: 3, pe: 4 }, primaryAttr: 'st', secondaryAttr: 'co' },
    { name: 'Mago', slug: 'mago', icon: '🔮', role: 'dps' as const, position: 'rear' as const, difficulty: 'intermediate' as const, description: 'Maestro de las artes arcanas. Alto daño mágico pero poca defensa.', baseAttrs: { st: 2, co: 4, dx: 4, ag: 3, in: 12, wi: 8, ch: 3, pe: 5 }, primaryAttr: 'in', secondaryAttr: 'wi' },
    { name: 'Arquero', slug: 'arquero', icon: '🏹', role: 'dps' as const, position: 'rear' as const, difficulty: 'beginner' as const, description: 'Atacante a distancia con gran precisión y agilidad.', baseAttrs: { st: 4, co: 5, dx: 10, ag: 8, in: 3, wi: 3, ch: 3, pe: 6 }, primaryAttr: 'dx', secondaryAttr: 'ag' },
    { name: 'Paladín', slug: 'paladin', icon: '🛡️', role: 'tank' as const, position: 'front' as const, difficulty: 'intermediate' as const, description: 'Caballero sagrado que protege a sus aliados con fe y acero.', baseAttrs: { st: 10, co: 8, dx: 5, ag: 3, in: 4, wi: 8, ch: 6, pe: 4 }, primaryAttr: 'st', secondaryAttr: 'wi' },
    { name: 'Asesino', slug: 'asesino', icon: '🗡️', role: 'dps' as const, position: 'center' as const, difficulty: 'advanced' as const, description: 'Luchador sigiloso que ataca desde las sombras con golpes críticos.', baseAttrs: { st: 4, co: 4, dx: 10, ag: 10, in: 3, wi: 2, ch: 4, pe: 6 }, primaryAttr: 'ag', secondaryAttr: 'dx' },
    { name: 'Clérigo', slug: 'clerigo', icon: '✨', role: 'healer' as const, position: 'rear' as const, difficulty: 'intermediate' as const, description: 'Sanador divino que restaura la vida y purifica males.', baseAttrs: { st: 4, co: 6, dx: 4, ag: 3, in: 6, wi: 10, ch: 8, pe: 4 }, primaryAttr: 'wi', secondaryAttr: 'in' },
    { name: 'Bárbaro', slug: 'barbaro', icon: '🪓', role: 'dps' as const, position: 'front' as const, difficulty: 'beginner' as const, description: 'Guerrero furioso que canaliza su ira en combate.', baseAttrs: { st: 12, co: 10, dx: 5, ag: 5, in: 2, wi: 2, ch: 3, pe: 3 }, primaryAttr: 'st', secondaryAttr: 'co' },
    { name: 'Druida', slug: 'druida', icon: '🌿', role: 'hybrid' as const, position: 'center' as const, difficulty: 'advanced' as const, description: 'Guardián de la naturaleza con poder curativo y ofensivo.', baseAttrs: { st: 4, co: 6, dx: 5, ag: 4, in: 8, wi: 8, ch: 4, pe: 6 }, primaryAttr: 'wi', secondaryAttr: 'in' },
  ]
  for (const c of classes) {
    await db.class.upsert({ where: { slug: c.slug }, update: {}, create: stripNulls({ ...c, lore: null, unlockCondition: null, tier: 1 }) as any })
  }
}

async function seedRaces() {
  const races = [
    { name: 'Humano', slug: 'humano', icon: '🧑', flavor: 'Versátil y adaptable', lore: 'La raza más diversa de Ironhold.', attrMods: { st: 1, co: 1, dx: 1, ag: 1, in: 1, wi: 1, ch: 1, pe: 1 }, racialTraits: [{ name: 'Versatilidad', desc: '+1 a todos los atributos' }], bestForClasses: [1, 2, 3] },
    { name: 'Elfo', slug: 'elfo', icon: '🧝', flavor: 'Ágil y sabio', lore: 'Habitantes de los bosques ancestrales.', attrMods: { st: -1, co: 0, dx: 2, ag: 2, in: 1, wi: 1, ch: 1, pe: 2 }, racialTraits: [{ name: 'Visión Nocturna', desc: '+2 al atributo pe' }], bestForClasses: [2, 3, 5] },
    { name: 'Enano', slug: 'enano', icon: '⛏️', flavor: 'Robusto y tenaz', lore: 'Maestros de la forja y la piedra.', attrMods: { st: 2, co: 2, dx: 0, ag: -1, in: 0, wi: 1, ch: -1, pe: 1 }, racialTraits: [{ name: 'Resistencia Enana', desc: '+2 a la constitución' }], bestForClasses: [1, 4, 7] },
    { name: 'Orco', slug: 'orco', icon: '👹', flavor: 'Feroz y fuerte', lore: 'Guerreros nómadas de las tierras yermas.', attrMods: { st: 3, co: 2, dx: 0, ag: 0, in: -2, wi: -1, ch: -2, pe: 0 }, racialTraits: [{ name: 'Furia Orca', desc: '+3 a la fuerza' }], bestForClasses: [1, 7] },
    { name: 'Gnomo', slug: 'gnomo', icon: '🧙', flavor: 'Ingenioso y astuto', lore: 'Inventores y magos por naturaleza.', attrMods: { st: -2, co: 1, dx: 1, ag: 1, in: 2, wi: 0, ch: 0, pe: 1 }, racialTraits: [{ name: 'Mente Aguda', desc: '+2 a inteligencia' }], bestForClasses: [2, 6, 8] },
    { name: 'Mediano', slug: 'mediano', icon: '🍀', flavor: 'Afortunado y resistente', lore: 'Pequeños pero de gran corazón.', attrMods: { st: -2, co: 1, dx: 2, ag: 1, in: 0, wi: 1, ch: 1, pe: 0 }, racialTraits: [{ name: 'Suerte Mediana', desc: '+1 a todas las defensas' }], bestForClasses: [3, 5, 6] },
    { name: 'Semielfo', slug: 'semielfo', icon: '🧝‍♂️', flavor: 'Carismático y versátil', lore: 'Puente entre dos mundos.', attrMods: { st: 0, co: 0, dx: 1, ag: 1, in: 1, wi: 0, ch: 2, pe: 1 }, racialTraits: [{ name: 'Diplomático', desc: '+2 a carisma' }], bestForClasses: [4, 6, 8] },
    { name: 'Tiefling', slug: 'tiefling', icon: '😈', flavor: 'Sombrío y poderoso', lore: 'Descendientes de antiguos pactos infernales.', attrMods: { st: 0, co: 0, dx: 0, ag: 1, in: 2, wi: 1, ch: 2, pe: -1 }, racialTraits: [{ name: 'Resistencia Infernal', desc: '+2 a resistencia mágica' }], bestForClasses: [2, 5, 8] },
  ]
  for (const r of races) {
    await db.race.upsert({ where: { slug: r.slug }, update: {}, create: r })
  }
}

async function seedSkills(): Promise<Record<string, number>> {
  const classMap: Record<string, number> = {}
  const allClasses = await db.class.findMany()
  for (const c of allClasses) classMap[c.slug] = c.id

  const raceMap: Record<string, number> = {}
  const allRaces = await db.race.findMany()
  for (const r of allRaces) raceMap[r.slug] = r.id

  // Each skill belongs to a path. T1=starter, T2=mid, T3=capstone.
  // requiresSlugs chains skills within a path — resolves to IDs after creation.
  const skills: any[] = [
    // ═══════════ GUERRERO (clase 1) ═══════════
    // Path DPS: Golpe Básico → Golpe Poderoso → Tajo Profundo
    { classId: classMap.guerrero, slug: 'golpe-basico', name: 'Golpe Básico', icon: '⚔️', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque cuerpo a cuerpo básico.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.2, cooldownRounds: 0, tags: ['melee'], formula: { damageType: 'physical', diceCount: 1, diceSides: 6, diceDivisor: 2 } },
    { classId: classMap.guerrero, slug: 'golpe-poderoso', name: 'Golpe Poderoso', icon: '💥', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Ataque devastador que ignora armadura.', effect: 'attack', epCost: 10, goldCost: 50, manaCost: 8, multiplier: 2.0, cooldownRounds: 2, tags: ['melee'], formula: { damageType: 'physical', diceCount: 2, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['golpe-basico'] },
    { classId: classMap.guerrero, slug: 'tajo-profundo', name: 'Tajo Profundo', icon: '⚡', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Corte profundo que perfora armaduras.', effect: 'armor_penetration', epCost: 25, goldCost: 150, manaCost: 15, multiplier: 2.5, cooldownRounds: 3, tags: ['melee'], formula: { damageType: 'physical', diceCount: 3, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['golpe-poderoso'] },
    // Path Tank: Postura Defensiva → Provocar → Defensa Total
    { classId: classMap.guerrero, slug: 'postura-defensiva', name: 'Postura Defensiva', icon: '🛡️', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Aumenta tu propia defensa.', effect: 'defense_up', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.3, cooldownRounds: 2, tags: ['buff'], formula: null },
    { classId: classMap.guerrero, slug: 'provocar', name: 'Provocar', icon: '👊', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Obliga al enemigo a atacarte.', effect: 'taunt', epCost: 10, goldCost: 50, manaCost: 5, multiplier: 1.0, cooldownRounds: 2, tags: ['buff'], formula: null, requiresSlugs: ['postura-defensiva'] },
    { classId: classMap.guerrero, slug: 'defensa-total', name: 'Defensa Total', icon: '🔰', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Aumenta la defensa de todo el grupo.', effect: 'defense_up', epCost: 20, goldCost: 100, manaCost: 15, multiplier: 1.5, cooldownRounds: 3, tags: ['buff'], formula: null, requiresSlugs: ['provocar'] },
    // Path Support: Grito de Guerra → Orden de Carga → Liderazgo
    { classId: classMap.guerrero, slug: 'grito-guerra', name: 'Grito de Guerra', icon: '📢', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Aumenta el ataque de todo el grupo.', effect: 'party_attack_up', epCost: 0, goldCost: 0, manaCost: 5, multiplier: 1.2, cooldownRounds: 2, tags: ['buff'], formula: null },
    { classId: classMap.guerrero, slug: 'orden-carga', name: 'Orden de Carga', icon: '🏃', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Aumenta el ataque y la velocidad del grupo.', effect: 'party_attack_up', epCost: 15, goldCost: 75, manaCost: 10, multiplier: 1.4, cooldownRounds: 3, tags: ['buff'], formula: null, requiresSlugs: ['grito-guerra'] },
    { classId: classMap.guerrero, slug: 'liderazgo', name: 'Liderazgo', icon: '⭐', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Inspira al grupo mejorando todas sus habilidades.', effect: 'buff', epCost: 25, goldCost: 150, manaCost: 20, multiplier: 1.5, cooldownRounds: 4, tags: ['buff'], formula: null, requiresSlugs: ['orden-carga'] },
    { classId: classMap.guerrero, slug: 'golpe-tierra', name: 'Golpe de Tierra', icon: '🌍', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Golpe que aturde al enemigo (solo Enanos).', effect: 'attack', epCost: 12, goldCost: 60, manaCost: 10, multiplier: 1.6, cooldownRounds: 2, tags: ['melee'], formula: { damageType: 'physical', diceCount: 2, diceSides: 4, diceDivisor: 2 }, raceReq: [raceMap.enano] },

    // ═══════════ MAGO (clase 2) ═══════════
    // Path Fire: Bola de Fuego → Llama Ardiente → Meteoro
    { classId: classMap.mago, slug: 'bola-fuego', name: 'Bola de Fuego', icon: '🔥', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque mágico de fuego.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 10, multiplier: 1.5, cooldownRounds: 0, tags: ['magic', 'fire'], formula: { damageType: 'fire', diceCount: 1, diceSides: 8, diceDivisor: 2 } },
    { classId: classMap.mago, slug: 'llama-ardiente', name: 'Llama Ardiente', icon: '🔥', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Poderosa llamada que quema al enemigo.', effect: 'attack', epCost: 15, goldCost: 75, manaCost: 20, multiplier: 2.0, cooldownRounds: 1, tags: ['magic', 'fire'], formula: { damageType: 'fire', diceCount: 2, diceSides: 8, diceDivisor: 3 }, requiresSlugs: ['bola-fuego'] },
    { classId: classMap.mago, slug: 'meteoro', name: 'Meteoro', icon: '☄️', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Invoca un meteoro que daña a todos los enemigos.', effect: 'aoe_attack', epCost: 30, goldCost: 200, manaCost: 35, multiplier: 1.8, cooldownRounds: 4, tags: ['magic', 'fire', 'aoe'], formula: { damageType: 'fire', diceCount: 3, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['llama-ardiente'] },
    // Path Lightning: Rayo → Cadena de Rayos → Tormenta Eléctrica
    { classId: classMap.mago, slug: 'rayo', name: 'Rayo', icon: '⚡', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque eléctrico básico.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 8, multiplier: 1.4, cooldownRounds: 0, tags: ['magic', 'lightning'], formula: { damageType: 'lightning', diceCount: 1, diceSides: 8, diceDivisor: 2 } },
    { classId: classMap.mago, slug: 'cadena-rayos', name: 'Cadena de Rayos', icon: '🌩️', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Rayo que salta entre enemigos.', effect: 'attack', epCost: 18, goldCost: 90, manaCost: 22, multiplier: 1.6, cooldownRounds: 2, tags: ['magic', 'lightning', 'aoe'], formula: { damageType: 'lightning', diceCount: 2, diceSides: 6, diceDivisor: 2 }, requiresSlugs: ['rayo'] },
    { classId: classMap.mago, slug: 'tormenta-electrica', name: 'Tormenta Eléctrica', icon: '⚡', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Tormenta de rayos que golpea a todos los enemigos.', effect: 'aoe_attack', epCost: 30, goldCost: 200, manaCost: 35, multiplier: 2.0, cooldownRounds: 4, tags: ['magic', 'lightning', 'aoe'], formula: { damageType: 'lightning', diceCount: 3, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['cadena-rayos'] },
    // Path Arcane: Misil Arcano → Toque de Maná → Poder Arcano
    { classId: classMap.mago, slug: 'misil-arcano', name: 'Misil Arcano', icon: '🔮', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Proyectil de energía arcana.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 6, multiplier: 1.3, cooldownRounds: 0, tags: ['magic'], formula: { damageType: 'arcane', diceCount: 1, diceSides: 6, diceDivisor: 2 } },
    { classId: classMap.mago, slug: 'toque-mana', name: 'Toque de Maná', icon: '💜', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Absorbe maná del enemigo.', effect: 'mana_drain', epCost: 10, goldCost: 50, manaCost: 0, multiplier: 1.0, cooldownRounds: 2, tags: ['magic'], formula: { damageType: 'arcane', diceCount: 1, diceSides: 4, diceDivisor: 2 }, requiresSlugs: ['misil-arcano'] },
    { classId: classMap.mago, slug: 'poder-arcano', name: 'Poder Arcano', icon: '💫', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Potencia tu magia drásticamente por un turno.', effect: 'buff', epCost: 20, goldCost: 100, manaCost: 15, multiplier: 1.0, cooldownRounds: 4, tags: ['buff'], formula: null, requiresSlugs: ['toque-mana'] },
    { classId: classMap.mago, slug: 'explosion-arcana', name: 'Explosión Arcanam', icon: '💫', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Explosión arcana de corto alcance (solo Gnomos).', effect: 'attack', epCost: 12, goldCost: 60, manaCost: 15, multiplier: 1.8, cooldownRounds: 1, tags: ['magic', 'aoe'], formula: { damageType: 'arcane', diceCount: 2, diceSides: 4, diceDivisor: 2 }, raceReq: [raceMap.gnomo] },

    // ═══════════ ARQUERO (clase 3) ═══════════
    // Path Precision: Disparo Rápido → Disparo Preciso → Tiro Certero
    { classId: classMap.arquero, slug: 'disparo-rapido', name: 'Disparo Rápido', icon: '🏹', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque a distancia rápido.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.3, cooldownRounds: 0, tags: ['ranged'], formula: { damageType: 'physical', diceCount: 1, diceSides: 6, diceDivisor: 2 } },
    { classId: classMap.arquero, slug: 'disparo-precioso', name: 'Disparo Preciso', icon: '🎯', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Disparo que perfora armaduras.', effect: 'armor_penetration', epCost: 15, goldCost: 75, manaCost: 10, multiplier: 2.0, cooldownRounds: 2, tags: ['ranged'], formula: { damageType: 'physical', diceCount: 2, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['disparo-rapido'] },
    { classId: classMap.arquero, slug: 'tiro-certero', name: 'Tiro Certero', icon: '🎯', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Disparo mortífero de máxima precisión.', effect: 'critical_attack', epCost: 30, goldCost: 200, manaCost: 20, multiplier: 3.0, cooldownRounds: 3, tags: ['ranged'], formula: { damageType: 'physical', diceCount: 3, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['disparo-precioso'] },
    // Path Volley: Lluvia de Flechas → Ráfaga → Barrida
    { classId: classMap.arquero, slug: 'lluvia-flechas', name: 'Lluvia de Flechas', icon: '🌧️', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque múltiple a todos los enemigos.', effect: 'aoe_attack', epCost: 0, goldCost: 0, manaCost: 5, multiplier: 1.1, cooldownRounds: 1, tags: ['ranged', 'aoe'], formula: { damageType: 'physical', diceCount: 1, diceSides: 4, diceDivisor: 2 } },
    { classId: classMap.arquero, slug: 'rafaga', name: 'Ráfaga', icon: '💨', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Ráfaga de flechas que golpea múltiples veces.', effect: 'attack', epCost: 18, goldCost: 90, manaCost: 12, multiplier: 1.5, cooldownRounds: 2, tags: ['ranged', 'aoe'], formula: { damageType: 'physical', diceCount: 2, diceSides: 6, diceDivisor: 2 }, requiresSlugs: ['lluvia-flechas'] },
    { classId: classMap.arquero, slug: 'barrida', name: 'Barrida', icon: '🌪️', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Andanada de flechas que arrasa a todos los enemigos.', effect: 'aoe_attack', epCost: 30, goldCost: 200, manaCost: 25, multiplier: 1.6, cooldownRounds: 4, tags: ['ranged', 'aoe'], formula: { damageType: 'physical', diceCount: 3, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['rafaga'] },
    // Path Tactical: Marcación → Flecha de Distracción → Ojo de Águila
    { classId: classMap.arquero, slug: 'marcacion', name: 'Marcación', icon: '🔍', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Marca a un enemigo, aumentando el daño recibido.', effect: 'debuff', epCost: 0, goldCost: 0, manaCost: 3, multiplier: 1.0, cooldownRounds: 2, tags: ['ranged'], formula: null },
    { classId: classMap.arquero, slug: 'flecha-distraccion', name: 'Flecha de Distracción', icon: '🌀', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Reduce el ataque del enemigo.', effect: 'debuff', epCost: 12, goldCost: 60, manaCost: 8, multiplier: 1.0, cooldownRounds: 2, tags: ['ranged'], formula: null, requiresSlugs: ['marcacion'] },
    { classId: classMap.arquero, slug: 'ojo-aguila', name: 'Ojo de Águila', icon: '🦅', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Aumenta la precisión de todo el grupo.', effect: 'buff', epCost: 20, goldCost: 100, manaCost: 15, multiplier: 1.3, cooldownRounds: 3, tags: ['buff'], formula: null, requiresSlugs: ['flecha-distraccion'] },
    { classId: classMap.arquero, slug: 'flecha-lunar', name: 'Flecha Lunar', icon: '🌙', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Flecha imbuida de luz lunar (solo Elfos).', effect: 'attack', epCost: 14, goldCost: 70, manaCost: 12, multiplier: 2.0, cooldownRounds: 2, tags: ['ranged', 'magic'], formula: { damageType: 'light', diceCount: 1, diceSides: 8, diceDivisor: 2 }, raceReq: [raceMap.elfo] },

    // ═══════════ PALADIN (clase 4) ═══════════
    // Path Holy Warrior: Golpe Sagrado → Martillo de Justicia → Castigo Divino
    { classId: classMap.paladin, slug: 'golpe-sagrado', name: 'Golpe Sagrado', icon: '✨', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque imbuido de luz sagrada.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 5, multiplier: 1.4, cooldownRounds: 0, tags: ['melee', 'magic'], formula: { damageType: 'light', diceCount: 1, diceSides: 6, diceDivisor: 2 } },
    { classId: classMap.paladin, slug: 'martillo-justicia', name: 'Martillo de Justicia', icon: '🔨', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Poderoso martillo sagrado.', effect: 'attack', epCost: 15, goldCost: 75, manaCost: 12, multiplier: 2.0, cooldownRounds: 2, tags: ['melee', 'magic'], formula: { damageType: 'light', diceCount: 2, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['golpe-sagrado'] },
    { classId: classMap.paladin, slug: 'castigo-divino', name: 'Castigo Divino', icon: '⚡', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Poderoso ataque sagrado de área.', effect: 'aoe_attack', epCost: 30, goldCost: 200, manaCost: 30, multiplier: 1.8, cooldownRounds: 4, tags: ['magic', 'aoe'], formula: { damageType: 'light', diceCount: 3, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['martillo-justicia'] },
    // Path Protector: Escudo de Fe → Protección Divina → Sacrificio
    { classId: classMap.paladin, slug: 'escudo-fe', name: 'Escudo de Fe', icon: '🛡️', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Aumenta la defensa del grupo.', effect: 'defense_up', epCost: 0, goldCost: 0, manaCost: 5, multiplier: 1.2, cooldownRounds: 2, tags: ['buff'], formula: null },
    { classId: classMap.paladin, slug: 'proteccion-divina', name: 'Protección Divina', icon: '🌟', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Escudo sagrado que protege a todos los aliados.', effect: 'defense_up', epCost: 15, goldCost: 75, manaCost: 12, multiplier: 1.4, cooldownRounds: 3, tags: ['buff'], formula: null, requiresSlugs: ['escudo-fe'] },
    { classId: classMap.paladin, slug: 'sacrificio', name: 'Sacrificio', icon: '❤️', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Redirige el daño de un aliado hacia ti.', effect: 'taunt', epCost: 20, goldCost: 100, manaCost: 10, multiplier: 1.0, cooldownRounds: 4, tags: ['buff'], formula: null, requiresSlugs: ['proteccion-divina'] },
    // Path Retribution: Sello de Justicia → Venganza → Ira Vengativa
    { classId: classMap.paladin, slug: 'sello-justicia', name: 'Sello de Justicia', icon: '⚖️', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque sagrado que aturde al enemigo.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 5, multiplier: 1.2, cooldownRounds: 1, tags: ['melee', 'magic'], formula: { damageType: 'light', diceCount: 1, diceSides: 6, diceDivisor: 2 } },
    { classId: classMap.paladin, slug: 'venganza', name: 'Venganza', icon: '🔥', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Aumenta tu ataque drásticamente por un turno.', effect: 'buff', epCost: 12, goldCost: 60, manaCost: 8, multiplier: 1.0, cooldownRounds: 3, tags: ['buff'], formula: null, requiresSlugs: ['sello-justicia'] },
    { classId: classMap.paladin, slug: 'ira-vengativa', name: 'Ira Vengativa', icon: '💢', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Descarga toda tu ira en un ataque devastador.', effect: 'critical_attack', epCost: 30, goldCost: 200, manaCost: 25, multiplier: 2.5, cooldownRounds: 4, tags: ['melee', 'magic'], formula: { damageType: 'light', diceCount: 3, diceSides: 8, diceDivisor: 3 }, requiresSlugs: ['venganza'] },
    { classId: classMap.paladin, slug: 'aura-fe', name: 'Aura de Fé', icon: '🌟', type: 'passive' as const, timing: 'passive' as const, tier: 2, description: 'Aura que protege al grupo (solo Semielfos).', effect: 'defense_up', epCost: 18, goldCost: 90, manaCost: 0, multiplier: 1.3, cooldownRounds: 0, tags: ['buff'], formula: null, raceReq: [raceMap.semielfo] },

    // ═══════════ ASESINO (clase 5) ═══════════
    // Path Dagger: Navajazo → Golpe desde las Sombras → Puñalada Letal
    { classId: classMap.asesino, slug: 'navajazo', name: 'Navajazo', icon: '🗡️', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque rápido con dagger.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.3, cooldownRounds: 0, tags: ['melee'], formula: { damageType: 'physical', diceCount: 1, diceSides: 4, diceDivisor: 2 } },
    { classId: classMap.asesino, slug: 'golpe-sombras', name: 'Golpe desde las Sombras', icon: '🌑', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Golpe crítico que hace daño masivo.', effect: 'critical_attack', epCost: 20, goldCost: 100, manaCost: 15, multiplier: 2.8, cooldownRounds: 3, tags: ['melee'], formula: { damageType: 'physical', diceCount: 2, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['navajazo'] },
    { classId: classMap.asesino, slug: 'punalada-letal', name: 'Puñalada Letal', icon: '💀', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Ataque letal que apunta a los puntos débiles.', effect: 'critical_attack', epCost: 30, goldCost: 200, manaCost: 25, multiplier: 3.5, cooldownRounds: 4, tags: ['melee'], formula: { damageType: 'physical', diceCount: 3, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['golpe-sombras'] },
    // Path Poison: Hoja Envenenada → Nube Tóxica → Veneno Mortal
    { classId: classMap.asesino, slug: 'veneno', name: 'Hoja Envenenada', icon: '☠️', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque que envenena al objetivo.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 5, multiplier: 1.3, cooldownRounds: 1, tags: ['melee'], formula: { damageType: 'poison', diceCount: 1, diceSides: 6, diceDivisor: 2 } },
    { classId: classMap.asesino, slug: 'nube-toxica', name: 'Nube Tóxica', icon: '💨', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Nube venenosa que daña a todos los enemigos.', effect: 'aoe_attack', epCost: 18, goldCost: 90, manaCost: 15, multiplier: 1.4, cooldownRounds: 2, tags: ['aoe'], formula: { damageType: 'poison', diceCount: 2, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['veneno'] },
    { classId: classMap.asesino, slug: 'veneno-mortal', name: 'Veneno Mortal', icon: '🧪', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Veneno letal que drena la vida del objetivo.', effect: 'attack', epCost: 25, goldCost: 150, manaCost: 20, multiplier: 2.0, cooldownRounds: 3, tags: ['melee'], formula: { damageType: 'poison', diceCount: 3, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['nube-toxica'] },
    // Path Shadow: Paso Sombrío → Cortina de Humo → Danza de Sombras
    { classId: classMap.asesino, slug: 'paso-sombrio', name: 'Paso Sombrío', icon: '👤', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Aumenta tu evasión.', effect: 'buff', epCost: 0, goldCost: 0, manaCost: 3, multiplier: 1.0, cooldownRounds: 2, tags: ['buff'], formula: null },
    { classId: classMap.asesino, slug: 'cortina-humo', name: 'Cortina de Humo', icon: '🌫️', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Aumenta la evasión de todo el grupo.', effect: 'buff', epCost: 14, goldCost: 70, manaCost: 10, multiplier: 1.0, cooldownRounds: 3, tags: ['buff'], formula: null, requiresSlugs: ['paso-sombrio'] },
    { classId: classMap.asesino, slug: 'danza-sombras', name: 'Danza de Sombras', icon: '🌀', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Evasión sobrehumana que protege de todo.', effect: 'buff', epCost: 22, goldCost: 120, manaCost: 15, multiplier: 1.0, cooldownRounds: 4, tags: ['buff'], formula: null, requiresSlugs: ['cortina-humo'] },
    { classId: classMap.asesino, slug: 'cuchilla-sombria', name: 'Cuchilla Sombría', icon: '🔪', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Ataque con energía infernal (solo Tieflings).', effect: 'attack', epCost: 16, goldCost: 80, manaCost: 10, multiplier: 2.2, cooldownRounds: 2, tags: ['melee', 'dark'], formula: { damageType: 'dark', diceCount: 2, diceSides: 4, diceDivisor: 2 }, raceReq: [raceMap.tiefling] },

    // ═══════════ CLERIGO (clase 6) ═══════════
    // Path Healer: Toque Curativo → Renovación → Cura Grupal
    { classId: classMap.clerigo, slug: 'toque-curativo', name: 'Toque Curativo', icon: '💚', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Cura a un aliado.', effect: 'heal', epCost: 0, goldCost: 0, manaCost: 10, multiplier: 1.5, cooldownRounds: 0, tags: ['heal'], formula: { damageType: 'light', healPct: 25 } },
    { classId: classMap.clerigo, slug: 'renovacion', name: 'Renovación', icon: '🌱', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Cura regenerativa que perdura en el tiempo.', effect: 'heal', epCost: 12, goldCost: 60, manaCost: 12, multiplier: 1.0, cooldownRounds: 2, tags: ['heal'], formula: { damageType: 'light', healPct: 30 }, requiresSlugs: ['toque-curativo'] },
    { classId: classMap.clerigo, slug: 'cura-grupo', name: 'Cura Grupal', icon: '💝', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Cura a todo el grupo.', effect: 'heal', epCost: 30, goldCost: 200, manaCost: 35, multiplier: 1.0, cooldownRounds: 4, tags: ['heal', 'aoe'], formula: { damageType: 'light', healPct: 20 }, requiresSlugs: ['renovacion'] },
    // Path Holy: Castigo Sagrado → Luz Purificadora → Juicio Final
    { classId: classMap.clerigo, slug: 'castigo-sagrado', name: 'Castigo Sagrado', icon: '⚡', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque sagrado básico (daño cuerpo a cuerpo ligero).', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 6, multiplier: 1.3, cooldownRounds: 0, tags: ['magic'], formula: { damageType: 'light', diceCount: 1, diceSides: 6, diceDivisor: 2 } },
    { classId: classMap.clerigo, slug: 'luz-purificadora', name: 'Luz Purificadora', icon: '🌟', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Ataque sagrado que daña a los enemigos.', effect: 'attack', epCost: 12, goldCost: 60, manaCost: 15, multiplier: 1.6, cooldownRounds: 1, tags: ['magic'], formula: { damageType: 'light', diceCount: 2, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['castigo-sagrado'] },
    { classId: classMap.clerigo, slug: 'juicio-final', name: 'Juicio Final', icon: '🔥', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Poder divino que daña a todos los enemigos.', effect: 'aoe_attack', epCost: 28, goldCost: 180, manaCost: 30, multiplier: 1.6, cooldownRounds: 4, tags: ['magic', 'aoe'], formula: { damageType: 'light', diceCount: 3, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['luz-purificadora'] },
    // Path Protection: Oración Protectora → Escudo Divino → Protección Total
    { classId: classMap.clerigo, slug: 'oracion-protectora', name: 'Oración Protectora', icon: '✨', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Bendice a un aliado aumentando su defensa.', effect: 'defense_up', epCost: 0, goldCost: 0, manaCost: 4, multiplier: 1.2, cooldownRounds: 1, tags: ['buff'], formula: null },
    { classId: classMap.clerigo, slug: 'escudo-divino', name: 'Escudo Divino', icon: '🛡️', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Escudo sagrado que protege a todos los aliados.', effect: 'defense_up', epCost: 14, goldCost: 70, manaCost: 12, multiplier: 1.3, cooldownRounds: 3, tags: ['buff'], formula: null, requiresSlugs: ['oracion-protectora'] },
    { classId: classMap.clerigo, slug: 'proteccion-total', name: 'Protección Total', icon: '🔰', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Poderosa protección divina para todo el grupo.', effect: 'defense_up', epCost: 25, goldCost: 150, manaCost: 20, multiplier: 1.6, cooldownRounds: 4, tags: ['buff'], formula: null, requiresSlugs: ['escudo-divino'] },
    { classId: classMap.clerigo, slug: 'bendicion-suerte', name: 'Bendición de la Suerte', icon: '🍀', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Aumenta la suerte del grupo (solo Medianos).', effect: 'buff', epCost: 10, goldCost: 50, manaCost: 8, multiplier: 1.2, cooldownRounds: 3, tags: ['buff'], formula: null, raceReq: [raceMap.mediano] },

    // ═══════════ BARBARO (clase 7) ═══════════
    // Path Berserker: Hachazo → Furia → Torbellino
    { classId: classMap.barbaro, slug: 'hachazo', name: 'Hachazo', icon: '🪓', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Poderoso golpe de hacha.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.4, cooldownRounds: 0, tags: ['melee'], formula: { damageType: 'physical', diceCount: 1, diceSides: 8, diceDivisor: 2 } },
    { classId: classMap.barbaro, slug: 'furia', name: 'Furia', icon: '💢', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Aumenta el ataque drásticamente.', effect: 'attack', epCost: 15, goldCost: 75, manaCost: 5, multiplier: 2.5, cooldownRounds: 3, tags: ['melee'], formula: { damageType: 'physical', diceCount: 2, diceSides: 8, diceDivisor: 3 }, requiresSlugs: ['hachazo'] },
    { classId: classMap.barbaro, slug: 'torbellino', name: 'Torbellino', icon: '🌀', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Ataque giratorio que golpea a todos.', effect: 'aoe_attack', epCost: 25, goldCost: 150, manaCost: 15, multiplier: 1.5, cooldownRounds: 3, tags: ['melee', 'aoe'], formula: { damageType: 'physical', diceCount: 2, diceSides: 6, diceDivisor: 2 }, requiresSlugs: ['furia'] },
    // Path Juggernaut: Resistencia → Pisotón → Inquebrantable
    { classId: classMap.barbaro, slug: 'resistencia', name: 'Resistencia', icon: '💪', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Aumenta tu defensa.', effect: 'defense_up', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.3, cooldownRounds: 2, tags: ['buff'], formula: null },
    { classId: classMap.barbaro, slug: 'pisoton', name: 'Pisotón', icon: '👢', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Golpe de tierra que aturde a los enemigos.', effect: 'attack', epCost: 12, goldCost: 60, manaCost: 5, multiplier: 1.4, cooldownRounds: 2, tags: ['melee', 'aoe'], formula: { damageType: 'physical', diceCount: 1, diceSides: 8, diceDivisor: 2 }, requiresSlugs: ['resistencia'] },
    { classId: classMap.barbaro, slug: 'inquebrantable', name: 'Inquebrantable', icon: '⛰️', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Defensa absoluta que reduce enormemente el daño recibido.', effect: 'defense_up', epCost: 20, goldCost: 100, manaCost: 10, multiplier: 2.0, cooldownRounds: 4, tags: ['buff'], formula: null, requiresSlugs: ['pisoton'] },
    // Path Blood: Sed de Sangre → Grito de Batalla → Frenesí
    { classId: classMap.barbaro, slug: 'sed-sangre', name: 'Sed de Sangre', icon: '🩸', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque que roba vida.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 3, multiplier: 1.2, cooldownRounds: 1, tags: ['melee'], formula: { damageType: 'physical', diceCount: 1, diceSides: 6, diceDivisor: 2 } },
    { classId: classMap.barbaro, slug: 'grito-batalla', name: 'Grito de Batalla', icon: '📣', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Aumenta el ataque de todo el grupo.', effect: 'party_attack_up', epCost: 14, goldCost: 70, manaCost: 8, multiplier: 1.3, cooldownRounds: 3, tags: ['buff'], formula: null, requiresSlugs: ['sed-sangre'] },
    { classId: classMap.barbaro, slug: 'frenesi', name: 'Frenesí', icon: '🔥', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Aumenta drásticamente el ataque y la velocidad.', effect: 'attack', epCost: 28, goldCost: 180, manaCost: 15, multiplier: 3.0, cooldownRounds: 4, tags: ['melee'], formula: { damageType: 'physical', diceCount: 3, diceSides: 8, diceDivisor: 3 }, requiresSlugs: ['grito-batalla'] },
    { classId: classMap.barbaro, slug: 'embestida-orca', name: 'Embestida Orca', icon: '🐗', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Embestida feroz que derriba enemigos (solo Orcos).', effect: 'attack', epCost: 14, goldCost: 70, manaCost: 6, multiplier: 2.0, cooldownRounds: 2, tags: ['melee'], formula: { damageType: 'physical', diceCount: 2, diceSides: 6, diceDivisor: 2 }, raceReq: [raceMap.orco] },

    // ═══════════ DRUIDA (clase 8) ═══════════
    // Path Nature: Fragmento de Hielo → Viento Helado → Tormenta Natural
    { classId: classMap.druida, slug: 'fragmento-hielo', name: 'Fragmento de Hielo', icon: '❄️', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque de hielo.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 8, multiplier: 1.3, cooldownRounds: 0, tags: ['magic', 'ice'], formula: { damageType: 'ice', diceCount: 1, diceSides: 6, diceDivisor: 2 } },
    { classId: classMap.druida, slug: 'viento-helado', name: 'Viento Helado', icon: '🌬️', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Viento gélido que daña a todos los enemigos.', effect: 'aoe_attack', epCost: 16, goldCost: 80, manaCost: 15, multiplier: 1.4, cooldownRounds: 2, tags: ['magic', 'ice', 'aoe'], formula: { damageType: 'ice', diceCount: 2, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['fragmento-hielo'] },
    { classId: classMap.druida, slug: 'tormenta', name: 'Tormenta Natural', icon: '🌪️', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Tormenta que daña a todos los enemigos.', effect: 'aoe_attack', epCost: 30, goldCost: 200, manaCost: 30, multiplier: 1.6, cooldownRounds: 4, tags: ['magic', 'aoe'], formula: { damageType: 'ice', diceCount: 3, diceSides: 6, diceDivisor: 3 }, requiresSlugs: ['viento-helado'] },
    // Path Restoration: Cura Natural → Regeneración → Tranquilidad
    { classId: classMap.druida, slug: 'cura-natural', name: 'Cura Natural', icon: '🌿', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Cura a un aliado con poder natural.', effect: 'heal', epCost: 0, goldCost: 0, manaCost: 8, multiplier: 1.3, cooldownRounds: 1, tags: ['heal'], formula: { damageType: 'light', healPct: 20 } },
    { classId: classMap.druida, slug: 'regeneracion', name: 'Regeneración', icon: '💚', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Cura regenerativa que perdura en el tiempo.', effect: 'heal', epCost: 14, goldCost: 70, manaCost: 12, multiplier: 1.0, cooldownRounds: 2, tags: ['heal'], formula: { damageType: 'light', healPct: 28 }, requiresSlugs: ['cura-natural'] },
    { classId: classMap.druida, slug: 'tranquilidad', name: 'Tranquilidad', icon: '🍃', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Cura a todo el grupo con poder natural.', effect: 'heal', epCost: 28, goldCost: 180, manaCost: 30, multiplier: 1.0, cooldownRounds: 4, tags: ['heal', 'aoe'], formula: { damageType: 'light', healPct: 22 }, requiresSlugs: ['regeneracion'] },
    // Path Shapeshifter: Zarpa → Piel de Corteza → Forma Salvaje
    { classId: classMap.druida, slug: 'zarpa', name: 'Zarpa', icon: '🐾', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque cuerpo a cuerpo con garras naturales.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.2, cooldownRounds: 0, tags: ['melee'], formula: { damageType: 'physical', diceCount: 1, diceSides: 6, diceDivisor: 2 } },
    { classId: classMap.druida, slug: 'piel-corteza-activa', name: 'Piel de Corteza', icon: '🌳', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Endurece tu piel para aumentar la defensa.', effect: 'defense_up', epCost: 10, goldCost: 50, manaCost: 6, multiplier: 1.3, cooldownRounds: 2, tags: ['buff'], formula: null, requiresSlugs: ['zarpa'] },
    { classId: classMap.druida, slug: 'forma-salvaje', name: 'Forma Salvaje', icon: '🐺', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Te transformas mejorando ataque y defensa.', effect: 'buff', epCost: 24, goldCost: 140, manaCost: 18, multiplier: 1.0, cooldownRounds: 4, tags: ['buff'], formula: null, requiresSlugs: ['piel-corteza-activa'] },
  ]

  // Resolve requiresSlugs → IDs and create skills
  const skillMap: Record<string, number> = {}
  for (const s of skills) {
    const { classId, requiresSlugs, ...rest } = s
    const aCat = s.tags?.includes('melee') ? 'melee' : s.tags?.includes('ranged') ? 'ranged' : s.tags?.includes('magic') ? 'magic' : null
    const reqIds: number[] = (requiresSlugs ?? []).map((slug: string) => skillMap[slug]).filter(Boolean)
    const created = await db.skill.upsert({
      where: { classId_slug: { classId: classId!, slug: s.slug } },
      update: {},
      create: stripNulls({ ...rest, class: classId != null ? { connect: { id: classId } } : undefined, attackCategory: aCat, maxRank: 10, requiresSkills: reqIds }) as any,
    })
    skillMap[s.slug] = created.id
  }
  return classMap
}

async function seedDefenseSkills(classMap: Record<string, number>) {
  const defSkills = [
    { classId: classMap.guerrero, slug: 'bloquear', name: 'Bloquear', icon: '🛡️', type: 'passive' as const, timing: 'passive' as const, tier: 1, effect: 'defense', defenseCategory: 'melee', description: 'Bloquea ataques cuerpo a cuerpo.', epCost: 5, goldCost: 25, manaCost: 0, multiplier: 1.0, cooldownRounds: 0, tags: ['defense'], attackCategory: null, formula: null },
    { classId: classMap.mago, slug: 'escudo-magico', name: 'Escudo Mágico', icon: '🛡️', type: 'passive' as const, timing: 'passive' as const, tier: 1, effect: 'defense', defenseCategory: 'magic', description: 'Escudo contra ataques mágicos.', epCost: 5, goldCost: 25, manaCost: 0, multiplier: 1.0, cooldownRounds: 0, tags: ['defense'], attackCategory: null, formula: null },
    { classId: classMap.arquero, slug: 'esquivar', name: 'Esquivar', icon: '💨', type: 'passive' as const, timing: 'passive' as const, tier: 1, effect: 'defense', defenseCategory: 'ranged', description: 'Esquiva ataques a distancia.', epCost: 5, goldCost: 25, manaCost: 0, multiplier: 1.0, cooldownRounds: 0, tags: ['defense'], attackCategory: null, formula: null },
    { classId: classMap.paladin, slug: 'interponer', name: 'Interponerse', icon: '🛡️', type: 'passive' as const, timing: 'passive' as const, tier: 1, effect: 'defense', defenseCategory: 'melee', description: 'Se interpone para proteger aliados.', epCost: 5, goldCost: 25, manaCost: 0, multiplier: 1.0, cooldownRounds: 0, tags: ['defense'], attackCategory: null, formula: null },
    { classId: classMap.asesino, slug: 'esquivar-sombras', name: 'Esquivar Sombras', icon: '🌑', type: 'passive' as const, timing: 'passive' as const, tier: 1, effect: 'defense', defenseCategory: 'ranged', description: 'Esquiva ataques con agilidad sobrehumana.', epCost: 5, goldCost: 25, manaCost: 0, multiplier: 1.0, cooldownRounds: 0, tags: ['defense'], attackCategory: null, formula: null },
    { classId: classMap.clerigo, slug: 'bendicion', name: 'Bendición Protectora', icon: '✨', type: 'passive' as const, timing: 'passive' as const, tier: 1, effect: 'defense', defenseCategory: 'magic', description: 'Protección divina contra magia.', epCost: 5, goldCost: 25, manaCost: 0, multiplier: 1.0, cooldownRounds: 0, tags: ['defense'], attackCategory: null, formula: null },
    { classId: classMap.barbaro, slug: 'resistir', name: 'Resistir', icon: '💪', type: 'passive' as const, timing: 'passive' as const, tier: 1, effect: 'defense', defenseCategory: 'melee', description: 'Resiste el daño físico.', epCost: 5, goldCost: 25, manaCost: 0, multiplier: 1.0, cooldownRounds: 0, tags: ['defense'], attackCategory: null, formula: null },
    { classId: classMap.druida, slug: 'piel-corteza', name: 'Piel de Corteza', icon: '🌳', type: 'passive' as const, timing: 'passive' as const, tier: 1, effect: 'defense', defenseCategory: 'magic', description: 'Piel endurecida que resiste magia.', epCost: 5, goldCost: 25, manaCost: 0, multiplier: 1.0, cooldownRounds: 0, tags: ['defense'], attackCategory: null, formula: null },
  ]
  for (const s of defSkills) {
    const { classId, ...rest } = s
    await db.skill.upsert({
      where: { classId_slug: { classId: classId!, slug: s.slug } },
      update: {},
      create: stripNulls({ ...rest, class: { connect: { id: classId! } }, maxRank: 10, requiresSkills: [], manaCost: 0, goldCost: s.goldCost, cooldownRounds: 0 }) as any,
    })
  }
}

async function seedEnemySkills() {
  const enemySkills = [
    { slug: 'escupir-veneno', name: 'Escupir Veneno', icon: '💚', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque venenoso.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.2, cooldownRounds: 0, tags: ['ranged', 'poison'], attackCategory: 'ranged', maxRank: 1, requiresSkills: [], formula: { damageType: 'poison', diceCount: 1, diceSides: 6, diceDivisor: 2 } },
    { slug: 'vendaje-rapido', name: 'Vendaje Rápido', icon: '🩹', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Cura sus heridas.', effect: 'heal', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.0, cooldownRounds: 2, tags: ['heal'], attackCategory: null, maxRank: 1, requiresSkills: [], formula: { damageType: 'light', healPct: 20 } },
    { slug: 'toque-espectral', name: 'Toque Espectral', icon: '👻', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Ataque fantasmal que drena vida.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.5, cooldownRounds: 1, tags: ['magic', 'dark'], attackCategory: 'magic', maxRank: 1, requiresSkills: [], formula: { damageType: 'dark', diceCount: 2, diceSides: 6, diceDivisor: 3 } },
    { slug: 'garras-afiladas', name: 'Garras Afiladas', icon: '🐾', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Ataque con garras.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.1, cooldownRounds: 0, tags: ['melee'], attackCategory: 'melee', maxRank: 1, requiresSkills: [], formula: { damageType: 'physical', diceCount: 1, diceSides: 6, diceDivisor: 2 } },
    { slug: 'mordisco', name: 'Mordisco', icon: '🦷', type: 'active' as const, timing: 'round' as const, tier: 1, description: 'Mordisco poderoso.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.3, cooldownRounds: 0, tags: ['melee'], attackCategory: 'melee', maxRank: 1, requiresSkills: [], formula: { damageType: 'physical', diceCount: 1, diceSides: 8, diceDivisor: 2 } },
    { slug: 'ala-vengativa', name: 'Ala Vengativa', icon: '🦅', type: 'active' as const, timing: 'round' as const, tier: 2, description: 'Ataque aéreo.', effect: 'attack', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.6, cooldownRounds: 1, tags: ['ranged'], attackCategory: 'ranged', maxRank: 1, requiresSkills: [], formula: { damageType: 'physical', diceCount: 2, diceSides: 6, diceDivisor: 3 } },
    { slug: 'golpe-tormenta', name: 'Golpe de Tormenta', icon: '🌩️', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Ataque eléctrico de área.', effect: 'aoe_attack', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 1.6, cooldownRounds: 3, tags: ['magic', 'aoe'], attackCategory: 'magic', maxRank: 1, requiresSkills: [], formula: { damageType: 'lightning', diceCount: 3, diceSides: 6, diceDivisor: 3 } },
    { slug: 'aliento-dragon', name: 'Aliento de Dragón', icon: '🐉', type: 'active' as const, timing: 'round' as const, tier: 3, description: 'Poderoso aliento de fuego.', effect: 'aoe_attack', epCost: 0, goldCost: 0, manaCost: 0, multiplier: 2.0, cooldownRounds: 4, tags: ['magic', 'aoe', 'fire'], attackCategory: 'magic', maxRank: 1, requiresSkills: [], formula: { damageType: 'fire', diceCount: 4, diceSides: 6, diceDivisor: 3 } },
  ]
  for (const s of enemySkills) {
    const existing = await db.skill.findFirst({ where: { classId: null, slug: s.slug } })
    if (existing) {
      await db.skill.update({ where: { id: existing.id }, data: stripNulls(s) as any })
    } else {
      await db.skill.create({ data: stripNulls(s) as any })
    }
  }
}

async function seedShopItems(classMap: Record<string, number>): Promise<{ skillBySlug: Record<string, number>; raceMap2: Record<string, number> }> {
  const skillBySlug: Record<string, number> = {}
  const allSkills = await db.skill.findMany()
  for (const s of allSkills) skillBySlug[s.slug] = s.id

  const raceMap2: Record<string, number> = {}
  const allRaces = await db.race.findMany()
  for (const r of allRaces) raceMap2[r.slug] = r.id

  const items = [
    { slug: 'espada-hierro', data: { name: 'Espada de Hierro', icon: '⚔️', category: 'weapon' as const, rarity: 'common' as const, description: 'Espada estándar de hierro.', stats: { st: 3, atk: 5 }, classReq: [classMap.guerrero, classMap.paladin, classMap.barbaro], levelReq: 1, price: 50, slot: 'mainHand' as const, twoHanded: false } },
    { slug: 'arco-corto', data: { name: 'Arco Corto', icon: '🏹', category: 'weapon' as const, rarity: 'common' as const, description: 'Arco ligero de madera.', stats: { dx: 3, atk: 4 }, classReq: [classMap.arquero], levelReq: 1, price: 50, slot: 'mainHand' as const, twoHanded: true } },
    { slug: 'baston-runico', data: { name: 'Bastón Rúnico', icon: '🪄', category: 'weapon' as const, rarity: 'common' as const, description: 'Bastón con runas mágicas.', stats: { in: 4, atk: 4 }, classReq: [classMap.mago, classMap.druida], levelReq: 1, price: 60, slot: 'mainHand' as const, twoHanded: true } },
    { slug: 'daga-acero', data: { name: 'Daga de Acero', icon: '🗡️', category: 'weapon' as const, rarity: 'common' as const, description: 'Daga afilada de acero.', stats: { ag: 3, atk: 3 }, classReq: [classMap.asesino, classMap.clerigo], levelReq: 1, price: 45, slot: 'mainHand' as const, twoHanded: false } },
    { slug: 'mazo-guerra', data: { name: 'Mazo de Guerra', icon: '🔨', category: 'weapon' as const, rarity: 'uncommon' as const, description: 'Mazo pesado de guerra.', stats: { st: 5, atk: 7 }, classReq: [classMap.guerrero, classMap.barbaro], levelReq: 3, price: 150, slot: 'mainHand' as const, twoHanded: true } },
    { slug: 'armadura-cuero', data: { name: 'Armadura de Cuero', icon: '🧥', category: 'armor' as const, rarity: 'common' as const, description: 'Armadura ligera de cuero.', stats: { co: 2, armor: 5 }, levelReq: 1, price: 40, slot: 'chest' as const } },
    { slug: 'cota-malla', data: { name: 'Cota de Malla', icon: '🛡️', category: 'armor' as const, rarity: 'uncommon' as const, description: 'Armadura de anillos de acero.', stats: { co: 4, armor: 10 }, levelReq: 3, price: 150, slot: 'chest' as const } },
    { slug: 'tunica-lino', data: { name: 'Túnica de Lino', icon: '👘', category: 'armor' as const, rarity: 'common' as const, description: 'Túnica ligera para magos.', stats: { in: 2, armor: 2 }, classReq: [classMap.mago, classMap.druida, classMap.clerigo], levelReq: 1, price: 35, slot: 'chest' as const } },
    { slug: 'collar-huesos', data: { name: 'Collar de Huesos', icon: '📿', category: 'accessory' as const, rarity: 'common' as const, description: 'Collar tribal.', stats: { wi: 2 }, levelReq: 1, price: 30, slot: 'neck' as const } },
    { slug: 'anillo-poder', data: { name: 'Anillo de Poder', icon: '💍', category: 'accessory' as const, rarity: 'rare' as const, description: 'Anillo imbuido de poder.', stats: { in: 4, wi: 2 }, levelReq: 5, price: 300, slot: 'neck' as const } },
    { slug: 'cinturon-cuero', data: { name: 'Cinturón de Cuero', icon: '🔗', category: 'armor' as const, rarity: 'common' as const, description: 'Cinturón resistente.', stats: { co: 1 }, levelReq: 1, price: 20, slot: 'belt' as const } },
    { slug: 'brazales-cuero', data: { name: 'Brazales de Cuero', icon: '🦾', category: 'armor' as const, rarity: 'common' as const, description: 'Protección para los brazos.', stats: { armor: 2 }, levelReq: 1, price: 25, slot: 'arms' as const } },
    { slug: 'yelmo-acero', data: { name: 'Yelmo de Acero', icon: '⛑️', category: 'armor' as const, rarity: 'uncommon' as const, description: 'Casco de acero forjado.', stats: { co: 2, armor: 3 }, levelReq: 3, price: 100, slot: 'head' as const } },
    { slug: 'escudo-roble', data: { name: 'Escudo de Roble', icon: '🛡️', category: 'armor' as const, rarity: 'common' as const, description: 'Escudo de madera de roble.', stats: { co: 3, armor: 5 }, classReq: [classMap.guerrero, classMap.paladin], levelReq: 1, price: 40, slot: 'offHand' as const } },
    { slug: 'pocion-vida', data: { name: 'Poción de Vida', icon: '🧪', category: 'consumable' as const, rarity: 'common' as const, description: 'Recupera 50 HP.', stats: { heal: 50 }, levelReq: 1, price: 25 } },
    { slug: 'pocion-mana', data: { name: 'Poción de Maná', icon: '💜', category: 'consumable' as const, rarity: 'common' as const, description: 'Recupera 30 MP.', stats: { mana: 30 }, levelReq: 1, price: 30 } },
  ]
  for (const item of items) {
    await db.item.upsert({
      where: { slug: item.slug },
      update: {},
      create: stripNulls({ ...item.data, slug: item.slug, classReq: item.data.classReq ?? [], raceReq: [], skillReq: [], runeSlots: 0, isCraftable: false, recipe: null, attrReq: null }) as any,
    })
  }

  return { skillBySlug, raceMap2 }
}

async function seedItemConfig(): Promise<Record<string, number>> {
  const itemSlugMap: Record<string, number> = {}
  const allItems = await db.item.findMany()
  for (const i of allItems) itemSlugMap[i.slug] = i.id
  return itemSlugMap
}

async function seedRuneItems() {
  const runes = [
    { slug: 'runa-fuego', data: { name: 'Runa de Fuego', icon: '🔥', category: 'rune' as const, rarity: 'uncommon' as const, description: 'Añade daño de fuego.', stats: { fireDmg: 3 }, levelReq: 3, price: 100 } },
    { slug: 'runa-hielo', data: { name: 'Runa de Hielo', icon: '❄️', category: 'rune' as const, rarity: 'uncommon' as const, description: 'Añade daño de hielo.', stats: { iceDmg: 3 }, levelReq: 3, price: 100 } },
    { slug: 'runa-sangre', data: { name: 'Runa de Sangre', icon: '🩸', category: 'rune' as const, rarity: 'rare' as const, description: 'Drena 10% del daño como vida.', stats: { lifesteal: 0.1 }, levelReq: 5, price: 250 } },
  ]
  for (const r of runes) {
    await db.item.upsert({
      where: { slug: r.slug },
      update: {},
      create: stripNulls({ ...r.data, slug: r.slug, classReq: [], raceReq: [], skillReq: [], runeSlots: 0, isCraftable: false, recipe: null, slot: null, attrReq: null }) as any,
    })
  }
}

async function seedEarlyDungeons(itemSlugMap: Record<string, number>) {
  const _i = (slug: string) => itemSlugMap[slug]
  const dungeons = [
    {
      slug: 'bosque-oscuro', name: 'Bosque Oscuro', icon: '🌲', region: 'Valdheim',
      description: 'Un bosque espeso habitado por criaturas salvajes.', lore: 'Los árboles susurran secretos antiguos.',
      levelReq: 1, recommendedLevel: 2, difficulty: 1, difficultyLabel: 'Fácil', epReward: 20, goldReward: 50, fameReward: 2,
      levels: [
        { number: 1, locationName: 'Entrada del Bosque', enemies: [{ id: 1, count: 2, pos: 'front' }, { id: 2, count: 1, pos: 'front' }], epReward: 5, goldReward: 15 },
        { number: 2, locationName: 'Claro del Bosque', enemies: [{ id: 1, count: 2, pos: 'front' }, { id: 2, count: 1, pos: 'front' }], epReward: 7, goldReward: 20 },
        { number: 3, locationName: 'Guardia del Bosque', enemies: [{ id: 2, count: 2, pos: 'front' }], epReward: 8, goldReward: 15 },
      ],
      lootTable: [
        { chance: 0.5, itemId: _i('pocion-vida'), minQty: 1, maxQty: 2 },
        { chance: 0.3, itemId: _i('pocion-mana'), minQty: 1, maxQty: 1 },
        { chance: 0.1, itemId: _i('espada-hierro'), minQty: 1, maxQty: 1 },
      ],
    },
    {
      slug: 'cuevas-olvidadas', name: 'Cuevas Olvidadas', icon: '🕳️', region: 'Valdheim',
      description: 'Cuevas profundas llenas de criaturas de las sombras.', lore: 'Antiguo refugio de bandidos.',
      levelReq: 2, recommendedLevel: 4, difficulty: 2, difficultyLabel: 'Normal', epReward: 35, goldReward: 80, fameReward: 3,
      levels: [
        { number: 1, locationName: 'Entrada de la Cueva', enemies: [{ id: 3, count: 2, pos: 'front' }], epReward: 10, goldReward: 25 },
        { number: 2, locationName: 'Cámaras Internas', enemies: [{ id: 3, count: 2, pos: 'front' }, { id: 4, count: 1, pos: 'front' }], epReward: 12, goldReward: 30 },
        { number: 3, locationName: 'Santuario Olvidado', enemies: [{ id: 4, count: 2, pos: 'front' }, { id: 3, count: 1, pos: 'front' }], epReward: 13, goldReward: 25 },
      ],
      lootTable: [
        { chance: 0.4, itemId: _i('pocion-vida'), minQty: 2, maxQty: 3 },
        { chance: 0.25, itemId: _i('collar-huesos'), minQty: 1, maxQty: 1 },
        { chance: 0.1, itemId: _i('cinturon-cuero'), minQty: 1, maxQty: 1 },
      ],
    },
    {
      slug: 'ruinas-ancestrales', name: 'Ruinas Ancestrales', icon: '🏛️', region: 'Valdheim',
      description: 'Restos de una civilización antigua.', lore: 'Se dice que guarda tesoros inimaginables.',
      levelReq: 4, recommendedLevel: 6, difficulty: 3, difficultyLabel: 'Difícil', epReward: 50, goldReward: 120, fameReward: 5,
      levels: [
        { number: 1, locationName: 'Patio de las Ruinas', enemies: [{ id: 5, count: 2, pos: 'front' }], epReward: 15, goldReward: 35 },
        { number: 2, locationName: 'Sala Principal', enemies: [{ id: 5, count: 2, pos: 'front' }, { id: 6, count: 1, pos: 'rear' }], epReward: 17, goldReward: 45 },
        { number: 3, locationName: 'Cripta del Rey', enemies: [{ id: 6, count: 2, pos: 'rear' }, { id: 5, count: 1, pos: 'front' }], epReward: 18, goldReward: 40 },
      ],
      lootTable: [
        { chance: 0.5, itemId: _i('pocion-vida'), minQty: 2, maxQty: 4 },
        { chance: 0.2, itemId: _i('brazales-cuero'), minQty: 1, maxQty: 1 },
        { chance: 0.1, itemId: _i('cota-malla'), minQty: 1, maxQty: 1 },
        { chance: 0.05, itemId: _i('anillo-poder'), minQty: 1, maxQty: 1 },
      ],
    },
  ]
  for (const d of dungeons) {
    await db.dungeon.upsert({
      where: { slug: d.slug },
      update: {},
      create: { ...d, isInstant: false, isEventOnly: false, scheduledTimes: ['02:00', '06:00', '10:00', '14:00', '18:00', '22:00'] },
    })
  }
}

async function seedInitialEnemies() {
  const enemies = [
    { id: 1, name: 'Lobo Hambriento', icon: '🐺', hp: 30, mp: 0, atk: 8, def: 4, dx: 12, ag: 10, level: 1, baseLevel: 1, growthFactor: 1.2, position: 'front' as const, damageType: 'physical', ai: { type: 'weakest' }, lootTable: { goldMin: 5, goldMax: 15 }, faction: null, conditions: null },
    { id: 2, name: 'Oso Menor', icon: '🐻', hp: 50, mp: 0, atk: 10, def: 6, dx: 6, ag: 4, level: 2, baseLevel: 2, growthFactor: 1.3, position: 'front' as const, damageType: 'physical', ai: { type: 'strongest' }, lootTable: { goldMin: 10, goldMax: 25 }, faction: null, conditions: null },
    { id: 3, name: 'Murciélago Gigante', icon: '🦇', hp: 25, mp: 0, atk: 9, def: 3, dx: 14, ag: 12, level: 2, baseLevel: 2, growthFactor: 1.2, position: 'center' as const, damageType: 'physical', ai: { type: 'weakest' }, lootTable: { goldMin: 8, goldMax: 20 }, faction: null, conditions: null },
    { id: 4, name: 'Escorpión de Arena', icon: '🦂', hp: 40, mp: 5, atk: 12, def: 8, dx: 8, ag: 6, level: 3, baseLevel: 3, growthFactor: 1.3, position: 'front' as const, damageType: 'physical', ai: { type: 'weakest' }, lootTable: { goldMin: 15, goldMax: 30 }, faction: null, conditions: null },
    { id: 5, name: 'Esqueleto Guerrero', icon: '💀', hp: 45, mp: 0, atk: 11, def: 10, dx: 6, ag: 4, level: 4, baseLevel: 4, growthFactor: 1.3, position: 'front' as const, damageType: 'physical', ai: { type: 'strongest' }, lootTable: { goldMin: 20, goldMax: 40 }, faction: null, conditions: null },
    { id: 6, name: 'Espectro Menor', icon: '👻', hp: 30, mp: 20, atk: 14, def: 5, dx: 10, ag: 8, level: 5, baseLevel: 5, growthFactor: 1.4, position: 'rear' as const, damageType: 'dark', ai: { type: 'weakest' }, lootTable: { goldMin: 25, goldMax: 50 }, faction: null, conditions: null },
  ]
  for (const e of enemies) {
    await db.enemy.upsert({ where: { id: e.id }, update: {}, create: stripNulls(e) as any })
  }
}

async function seedLateGameEnemies() {
  const enemies = [
    { id: 7, name: 'Troll del Pantano', icon: '🧌', hp: 120, mp: 0, atk: 18, def: 12, dx: 4, ag: 3, level: 8, baseLevel: 8, growthFactor: 1.4, position: 'front' as const, damageType: 'physical', ai: { type: 'strongest' }, lootTable: { goldMin: 40, goldMax: 80 }, faction: null, conditions: null },
    { id: 8, name: 'Araña Sombría', icon: '🕷️', hp: 60, mp: 15, atk: 16, def: 6, dx: 14, ag: 12, level: 7, baseLevel: 7, growthFactor: 1.3, position: 'center' as const, damageType: 'poison', ai: { type: 'weakest' }, lootTable: { goldMin: 35, goldMax: 70 }, faction: null, conditions: null },
    { id: 9, name: 'Gólem de Piedra', icon: '🗿', hp: 200, mp: 0, atk: 22, def: 20, dx: 2, ag: 2, level: 10, baseLevel: 10, growthFactor: 1.5, position: 'front' as const, damageType: 'physical', ai: { type: 'strongest' }, lootTable: { goldMin: 60, goldMax: 120 }, faction: null, conditions: null },
    { id: 10, name: 'Nigromante', icon: '🧙', hp: 80, mp: 50, atk: 20, def: 8, dx: 10, ag: 8, level: 10, baseLevel: 10, growthFactor: 1.5, position: 'rear' as const, damageType: 'dark', ai: { type: 'weakest' }, lootTable: { goldMin: 50, goldMax: 100 }, faction: null, conditions: null },
    { id: 11, name: 'Dragón Joven', icon: '🐉', hp: 300, mp: 40, atk: 28, def: 18, dx: 8, ag: 6, level: 15, baseLevel: 15, growthFactor: 1.6, position: 'front' as const, damageType: 'fire', ai: { type: 'strongest' }, lootTable: { goldMin: 100, goldMax: 200 }, faction: null, conditions: null },
    { id: 12, name: 'Caballero Oscuro', icon: '⚫', hp: 180, mp: 30, atk: 24, def: 16, dx: 8, ag: 6, level: 12, baseLevel: 12, growthFactor: 1.5, position: 'front' as const, damageType: 'dark', ai: { type: 'strongest' }, lootTable: { goldMin: 80, goldMax: 160 }, faction: null, conditions: null },
    { id: 13, name: 'Elemental de Hielo', icon: '❄️', hp: 100, mp: 40, atk: 22, def: 10, dx: 8, ag: 6, level: 9, baseLevel: 9, growthFactor: 1.4, position: 'rear' as const, damageType: 'ice', ai: { type: 'weakest' }, lootTable: { goldMin: 45, goldMax: 90 }, faction: null, conditions: null },
  ]
  for (const e of enemies) {
    await db.enemy.upsert({ where: { id: e.id }, update: {}, create: stripNulls(e) as any })
  }
}

async function seedTrapEnemies() {
  const traps = [
    { id: 14, name: 'Trampa de Pinchos', icon: '🪤', hp: 1, mp: 0, atk: 15, def: 0, dx: 0, ag: 0, level: 3, baseLevel: 3, growthFactor: 1.0, position: 'center' as const, damageType: 'physical', ai: { type: 'weakest' }, lootTable: null, faction: null, conditions: null },
    { id: 15, name: 'Trampa de Fuego', icon: '🔥', hp: 1, mp: 0, atk: 20, def: 0, dx: 0, ag: 0, level: 5, baseLevel: 5, growthFactor: 1.0, position: 'center' as const, damageType: 'fire', ai: { type: 'weakest' }, lootTable: null, faction: null, conditions: null },
    { id: 16, name: 'Trampa de Veneno', icon: '☠️', hp: 1, mp: 0, atk: 18, def: 0, dx: 0, ag: 0, level: 6, baseLevel: 6, growthFactor: 1.0, position: 'center' as const, damageType: 'poison', ai: { type: 'weakest' }, lootTable: null, faction: null, conditions: null },
  ]
  for (const t of traps) {
    await db.enemy.upsert({ where: { id: t.id }, update: {}, create: stripNulls(t) as any })
  }
}

async function assignEnemyDefenseSkills2(_skillBySlug: Record<string, number>) {
  const defOverrides: Record<number, string[]> = {
    4: ['esquivar'],
    5: ['bloquear'],
    6: ['escudo-magico'],
    7: ['resistir'],
    8: ['esquivar'],
    9: ['bloquear', 'resistir'],
    10: ['escudo-magico', 'bendicion'],
    11: ['resistir', 'interponer'],
    12: ['bloquear', 'interponer'],
  }
  const posMap: Record<string, string> = { front: 'bloquear', center: 'esquivar', rear: 'escudo-magico' }
  const allEnemies = await db.enemy.findMany()
  for (const e of allEnemies) {
    if (e.level < 3) continue
    const override = defOverrides[e.id] ?? []
    const defSlugs = override.length > 0 ? override : [posMap[e.position] ?? 'esquivar']
    const defIds = defSlugs.map(slug => _skillBySlug[slug]).filter(Boolean)
    const combined = [...new Set([...(e.skillIds ?? []), ...defIds])]
    if (combined.length !== (e.skillIds ?? []).length) {
      await db.enemy.update({ where: { id: e.id }, data: { skillIds: combined } })
    }
  }
}

async function seedMoreDungeons(itemSlugMap: Record<string, number>) {
  const _i = (slug: string) => itemSlugMap[slug]
  const dungeons = [
    {
      slug: 'torre-mago', name: 'Torre del Mago', icon: '🏰', region: 'Mystara',
      description: 'La torre de un poderoso mago llena de trampas y criaturas mágicas.', lore: 'Aquí vivió el archimago Valdus.',
      levelReq: 6, recommendedLevel: 8, difficulty: 4, difficultyLabel: 'Experto', epReward: 70, goldReward: 180, fameReward: 7,
      levels: [
        { number: 1, locationName: 'Planta Baja', enemies: [{ id: 6, count: 1, pos: 'rear' }, { id: 13, count: 1, pos: 'rear' }], epReward: 20, goldReward: 50 },
        { number: 2, locationName: 'Laboratorio', enemies: [{ id: 13, count: 1, pos: 'rear' }, { id: 10, count: 1, pos: 'rear' }], epReward: 25, goldReward: 60 },
        { number: 3, locationName: 'Azotea', enemies: [{ id: 10, count: 1, pos: 'rear' }, { id: 13, count: 1, pos: 'rear' }, { id: 12, count: 1, pos: 'front' }], epReward: 25, goldReward: 70 },
      ],
      lootTable: [
        { chance: 0.5, itemId: _i('pocion-mana'), minQty: 2, maxQty: 4 },
        { chance: 0.2, itemId: _i('baston-runico'), minQty: 1, maxQty: 1 },
        { chance: 0.1, itemId: _i('tunica-lino'), minQty: 1, maxQty: 1 },
      ],
    },
    {
      slug: 'montana-dragon', name: 'Montaña del Dragón', icon: '🗻', region: 'Drakkar',
      description: 'Una montaña donde un dragón guarda su tesoro.', lore: 'Nadie ha regresado con el tesoro.',
      levelReq: 12, recommendedLevel: 15, difficulty: 5, difficultyLabel: 'Jefe', epReward: 150, goldReward: 500, fameReward: 15,
      levels: [
        { number: 1, locationName: 'Faldas de la Montaña', enemies: [{ id: 7, count: 2, pos: 'front' }], epReward: 40, goldReward: 140 },
        { number: 2, locationName: 'Cueva del Dragón', enemies: [{ id: 9, count: 1, pos: 'front' }, { id: 12, count: 1, pos: 'front' }, { id: 7, count: 1, pos: 'front' }], epReward: 50, goldReward: 170 },
        { number: 3, locationName: 'Guarida del Dragón', enemies: [{ id: 11, count: 1, pos: 'front', isBoss: true }], epReward: 60, goldReward: 190 },
      ],
      lootTable: [
        { chance: 0.7, itemId: _i('pocion-vida'), minQty: 3, maxQty: 5 },
        { chance: 0.2, itemId: _i('anillo-poder'), minQty: 1, maxQty: 1 },
        { chance: 0.1, itemId: _i('cota-malla'), minQty: 1, maxQty: 1 },
      ],
    },
  ]
  for (const d of dungeons) {
    await db.dungeon.upsert({
      where: { slug: d.slug },
      update: {},
      create: { ...d, isInstant: false, isEventOnly: false, scheduledTimes: ['02:00', '06:00', '10:00', '14:00', '18:00', '22:00'] },
    })
  }
}

async function seedTestDungeon(itemSlugMap: Record<string, number>) {
  const _i = (slug: string) => itemSlugMap[slug] ?? 999
  const testDungeon = {
    slug: 'mazmorra-test',
    name: 'Mazmorra de Prueba',
    icon: '🧪',
    region: 'Test',
    description: 'Mazmorra de prueba instantánea. Sin tiempo de espera.',
    lore: 'Una zona de entrenamiento para nuevos aventureros.',
    levelReq: 1,
    recommendedLevel: 1,
    difficulty: 1,
    difficultyLabel: 'Prueba',
    epReward: 20,
    goldReward: 20,
    fameReward: 1,
    levels: [
      {
        number: 1,
        locationName: 'Sala de Entrenamiento',
        enemies: [{ id: 1, count: 1, pos: 'front' }],
        epReward: 10,
        goldReward: 10,
      },
      {
        number: 2,
        locationName: 'Sala de Práctica',
        enemies: [{ id: 1, count: 2, pos: 'front' }],
        epReward: 10,
        goldReward: 10,
      },
    ],
    lootTable: [
      { chance: 0.5, itemId: _i('pocion-vida'), minQty: 1, maxQty: 2 },
    ],
  }

  await db.dungeon.upsert({
    where: { slug: testDungeon.slug },
    update: { isInstant: true, scheduledTimes: [] },
    create: { ...testDungeon, isInstant: true, isEventOnly: false, scheduledTimes: [] },
  })
}

async function seedMaterials() {
  const materials = [
    { name: 'Madera de Roble', icon: '🪵', rarity: 'common' as const, description: 'Madera resistente de roble.', dropSources: ['Bosque Oscuro'] },
    { name: 'Fragmento de Hierro', icon: '⛓️', rarity: 'common' as const, description: 'Fragmento de hierro en bruto.', dropSources: ['Cuevas Olvidadas'] },
    { name: 'Cuero de Lobo', icon: '🦊', rarity: 'common' as const, description: 'Cuero curtido de lobo.', dropSources: ['Bosque Oscuro'] },
    { name: 'Polvo Mágico', icon: '✨', rarity: 'uncommon' as const, description: 'Polvo con residuos mágicos.', dropSources: ['Ruinas Ancestrales', 'Torre del Mago'] },
    { name: 'Cristal de Maná', icon: '💎', rarity: 'uncommon' as const, description: 'Cristal imbuido de maná.', dropSources: ['Torre del Mago'] },
    { name: 'Escama de Dragón', icon: '🔶', rarity: 'rare' as const, description: 'Escama de un dragón.', dropSources: ['Montaña del Dragón'] },
    { name: 'Esencia Oscura', icon: '⚫', rarity: 'rare' as const, description: 'Concentrado de energía oscura.', dropSources: ['Nigromante', 'Caballero Oscuro'] },
    { name: 'Piedra Rúnica', icon: '🪨', rarity: 'epic' as const, description: 'Piedra con runas antiguas.', dropSources: ['Montaña del Dragón'] },
  ]
  for (const m of materials) {
    const existing = await db.material.findUnique({ where: { name: m.name } })
    if (!existing) {
      await db.material.create({ data: m })
    }
  }
}

async function seedWeeklyEvents() {
  const now = new Date()
  const events = [
    {
      name: 'Cacería de Dragones', description: 'Derrota dragones para obtener recompensas especiales.',
      type: 'kill_boss', startsAt: new Date(now.getTime() + 86400000), endsAt: new Date(now.getTime() + 86400000 * 8),
      isActive: false, rewards: { gold: 500, items: ['runa-fuego'], fame: 20 },
    },
    {
      name: 'Invasión Oscura', description: 'Enfréntate a la horda de criaturas oscuras.',
      type: 'kill_enemies', startsAt: new Date(now.getTime() + 86400000 * 2), endsAt: new Date(now.getTime() + 86400000 * 9),
      isActive: false, rewards: { gold: 300, items: ['runa-sangre'], fame: 15 },
    },
    {
      name: 'Fiebre del Oro', description: 'Gana oro extra en todas las mazmorras.',
      type: 'gold_bonus', startsAt: new Date(now.getTime() + 86400000 * 3), endsAt: new Date(now.getTime() + 86400000 * 10),
      isActive: false, rewards: { gold: 200, fame: 10 },
    },
  ]
  await db.weeklyEvent.deleteMany()
  for (const e of events) {
    await db.weeklyEvent.create({ data: e })
  }
}

async function seedQuests(itemSlugMap: Record<string, number>) {
  const quests = [
    {
      slug: 'primer-paso', name: 'Primer Paso', type: 'main' as const,
      description: 'Derrota 3 lobos en el Bosque Oscuro.', npcName: 'Aldeano', npcDialog: '¡Los lobos nos están atacando! Ayúdanos.',
      objectives: [{ id: 'kill_wolves', type: 'total_kills' as const, required: 3 }], rewards: { gold: 100, ep: 50, items: ['pocion-vida'] },
      levelReq: 1, chainNext: 'bosque-profundo',
    },
    {
      slug: 'bosque-profundo', name: 'Bosque Profundo', type: 'main' as const,
      description: 'Explora las Ruinas Ancestrales.', npcName: 'Guardia', npcDialog: 'Hay ruinas peligrosas al este.',
      objectives: [{ id: 'dungeon_ruinas', type: 'dungeon_complete' as const, dungeonSlug: 'ruinas-ancestrales', required: 1 }], rewards: { gold: 200, ep: 100, items: ['collar-huesos'] },
      levelReq: 3, chainNext: 'torre-mago',
    },
    {
      slug: 'torre-mago', name: 'La Torre del Mago', type: 'main' as const,
      description: 'Completa la Torre del Mago.', npcName: 'Maga', npcDialog: 'El nigromante ha tomado la torre.',
      objectives: [{ id: 'dungeon_torre', type: 'dungeon_complete' as const, dungeonSlug: 'torre-mago', required: 1 }], rewards: { gold: 500, ep: 250, items: ['anillo-poder'] },
      levelReq: 6, chainNext: null,
    },
    {
      slug: 'cazador-lobos', name: 'Cazador de Lobos', type: 'daily' as const,
      description: 'Derrota 10 lobos.', npcName: 'Cazador', npcDialog: 'Siempre hay demasiados lobos.',
      objectives: [{ id: 'kill_lobos', type: 'total_kills' as const, required: 10 }], rewards: { gold: 50, ep: 25 },
      levelReq: 1, isRepeatable: true, resetHours: 24, chainNext: null,
    },
    {
      slug: 'recolector', name: 'Recolector Novato', type: 'daily' as const,
      description: 'Completa 3 mazmorras.', npcName: 'Maestro', npcDialog: 'La práctica hace al maestro.',
      objectives: [{ id: 'dungeon_any', type: 'dungeon_complete' as const, required: 3 }], rewards: { gold: 150, ep: 75 },
      levelReq: 1, isRepeatable: true, resetHours: 24, chainNext: null,
    },
  ]
  for (const q of quests) {
    await db.quest.upsert({
      where: { slug: q.slug },
      update: {},
      create: q,
    })
  }
}

async function seedAchievements() {
  const achievements = [
    { slug: 'primer-heroe', name: 'Primer Héroe', description: 'Creaste tu primer héroe.', icon: '⭐', category: 'general', condition: { type: 'create_hero', count: 1 }, rewards: { gold: 100 }, order: 1 },
    { slug: 'primer-dungeon', name: 'Aventurero Novato', description: 'Completa tu primera mazmorra.', icon: '🏆', category: 'dungeon', condition: { type: 'dungeon_complete', count: 1 }, rewards: { gold: 200 }, order: 2 },
    { slug: 'cazador-lobos', name: 'Cazador de Lobos', description: 'Derrota 50 lobos.', icon: '🐺', category: 'combat', condition: { type: 'kill_lobo_hambre', count: 50 }, rewards: { gold: 500, ep: 100 }, order: 3 },
    { slug: 'coleccionista', name: 'Coleccionista', description: 'Consigue 10 items diferentes.', icon: '📦', category: 'items', condition: { type: 'unique_items', count: 10 }, rewards: { gold: 300 }, order: 4 },
    { slug: 'legendario', name: '¡Legendario!', description: 'Alcanza el nivel 20.', icon: '👑', category: 'general', condition: { type: 'level_reach', level: 20 }, rewards: { gold: 2000, items: ['anillo-poder'] }, order: 5 },
    { slug: 'matadragones', name: 'Matadragones', description: 'Derrota al Dragón Joven.', icon: '🐉', category: 'combat', condition: { type: 'kill_enemy', enemy: 'dragon-joven', count: 1 }, rewards: { gold: 1000, items: ['escama-dragon'] }, order: 6 },
  ]
  for (const a of achievements) {
    await db.achievement.upsert({
      where: { slug: a.slug },
      update: {},
      create: a,
    })
  }
}

async function seedAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@ironhold.com'
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminPassword) {
    console.warn('⚠️  ADMIN_PASSWORD no definido — usuario admin NO creado. Definí ADMIN_PASSWORD en .env para crearlo.')
    return
  }

  const existing = await db.user.findUnique({ where: { email: adminEmail } })
  if (existing) return

  const hash = await bcrypt.hash(adminPassword, 10)
  await db.user.create({
    data: {
      email: adminEmail,
      name: 'Admin',
      passwordHash: hash,
      isAdmin: true,
    },
  })
  console.log(`✔ Usuario admin creado: ${adminEmail}`)
}

async function seedAttributeDefinitions() {
  const defs = [
    { name: 'Fuerza', abbreviation: 'st', description: 'Determina el daño físico y capacidad de carga.', minValue: 1, maxValue: 100 },
    { name: 'Constitución', abbreviation: 'co', description: 'Determina la vida máxima y resistencia.', minValue: 1, maxValue: 100 },
    { name: 'Destreza', abbreviation: 'dx', description: 'Determina la precisión y la defensa física.', minValue: 1, maxValue: 100 },
    { name: 'Agilidad', abbreviation: 'ag', description: 'Determina la velocidad y la evasión.', minValue: 1, maxValue: 100 },
    { name: 'Inteligencia', abbreviation: 'in', description: 'Determina el daño mágico y la capacidad de maná.', minValue: 1, maxValue: 100 },
    { name: 'Sabiduría', abbreviation: 'wi', description: 'Determina la curación y la resistencia mágica.', minValue: 1, maxValue: 100 },
    { name: 'Carisma', abbreviation: 'ch', description: 'Determina la interacción social y precios en tiendas.', minValue: 1, maxValue: 100 },
    { name: 'Percepción', abbreviation: 'pe', description: 'Determina la detección de trampas y emboscadas.', minValue: 1, maxValue: 100 },
  ]
  for (const d of defs) {
    await db.attributeDefinition.upsert({
      where: { abbreviation: d.abbreviation },
      update: {},
      create: d,
    })
  }
}

async function seedForumCategories() {
  const categories = [
    { slug: 'general', name: 'General', description: 'Discusión general del juego.', icon: '💬', order: 1 },
    { slug: 'guias', name: 'Guías y Tutoriales', description: 'Comparte tus estrategias y consejos.', icon: '📖', order: 2 },
    { slug: 'clanes', name: 'Clanes', description: 'Forma y gestiona tu clan.', icon: '🏰', order: 3 },
    { slug: 'sugerencias', name: 'Sugerencias', description: 'Propón mejoras para el juego.', icon: '💡', order: 4 },
    { slug: 'reportes', name: 'Reportes de Bugs', description: 'Reporta errores que encuentres.', icon: '🐛', order: 5 },
  ]
  for (const c of categories) {
    await db.forumCategory.upsert({
      where: { slug: c.slug },
      update: {},
      create: c,
    })
  }
}

async function seedFactions() {
  const factions = [
    { slug: 'guardianes-valdheim', name: 'Guardianes de Valdheim', description: 'Protectores de la región de Valdheim. Defienden el bosque y sus criaturas.', icon: '🌲', color: '#22C55E' },
    { slug: 'circulo-arcano', name: 'Círculo Arcano', description: 'Maestros de la magia que buscan conocimiento ancestral.', icon: '🔮', color: '#8B5CF6' },
    { slug: 'herreria-del-norte', name: 'Herrería del Norte', description: 'Maestros herreros que forjan las mejores armas.', icon: '⚒️', color: '#F97316' },
    { slug: 'comerciantes-libres', name: 'Comerciantes Libres', description: 'Gremio de comerciantes que controla la economía.', icon: '💰', color: '#EAB308' },
  ]
  for (const f of factions) {
    await db.faction.upsert({
      where: { slug: f.slug },
      update: {},
      create: f,
    })
  }
}

async function seedFactionShops() {
  const allFactions = await db.faction.findMany()
  const factionMap: Record<string, number> = {}
  for (const f of allFactions) factionMap[f.slug] = f.id

  const shops = [
    { factionId: factionMap['guardianes-valdheim'], name: 'Bosque Verde', icon: '🌿', minRep: 0, items: { items: [{ slug: 'pocion-vida', price: 20, discountRep: 100 }, { slug: 'armadura-cuero', price: 35, discountRep: 200 }] } },
    { factionId: factionMap['guardianes-valdheim'], name: 'Guardianes Élite', icon: '🌳', minRep: 500, items: { items: [{ slug: 'cota-malla', price: 120, discountRep: 500 }, { slug: 'yelmo-acero', price: 80, discountRep: 500 }] } },
    { factionId: factionMap['circulo-arcano'], name: 'Tienda Mágica', icon: '🔮', minRep: 0, items: { items: [{ slug: 'pocion-mana', price: 25, discountRep: 100 }, { slug: 'baston-runico', price: 50, discountRep: 200 }] } },
    { factionId: factionMap['circulo-arcano'], name: 'Arcanum', icon: '✨', minRep: 500, items: { items: [{ slug: 'tunica-lino', price: 30, discountRep: 500 }, { slug: 'anillo-poder', price: 250, discountRep: 1000 }] } },
    { factionId: factionMap['herreria-del-norte'], name: 'Forja del Norte', icon: '⚒️', minRep: 0, items: { items: [{ slug: 'espada-hierro', price: 40, discountRep: 100 }, { slug: 'escudo-roble', price: 35, discountRep: 200 }] } },
    { factionId: factionMap['herreria-del-norte'], name: 'Maestros Forjadores', icon: '🔨', minRep: 500, items: { items: [{ slug: 'mazo-guerra', price: 120, discountRep: 500 }, { slug: 'cota-malla', price: 120, discountRep: 500 }] } },
    { factionId: factionMap['comerciantes-libres'], name: 'Mercado General', icon: '🏪', minRep: 0, items: { items: [{ slug: 'pocion-vida', price: 22, discountRep: 100 }, { slug: 'pocion-mana', price: 27, discountRep: 100 }, { slug: 'cinturon-cuero', price: 18, discountRep: 200 }] } },
    { factionId: factionMap['comerciantes-libres'], name: 'Galería Premium', icon: '💎', minRep: 1000, items: { items: [{ slug: 'runa-fuego', price: 80, discountRep: 1000 }, { slug: 'runa-hielo', price: 80, discountRep: 1000 }] } },
  ]
  await db.factionShop.deleteMany()
  for (const s of shops) {
    await db.factionShop.create({ data: s })
  }
}

async function seedAdventures() {
  const factions = await db.faction.findMany()
  const fm: Record<string, number> = {}
  for (const f of factions) fm[f.slug] = f.id

  const adventures = [
    {
      name: 'El Bosque Susurrante',
      slug: 'bosque-susurrante',
      icon: '🌲',
      description: 'Un bosque encantado donde criaturas de sombra acechan entre los árboles.',
      lore: 'Los ancianos de Valdheim cuentan que el Bosque Susurrante no siempre fue un lugar de sombras. Antaño era un santuario druídico donde los árboles cantaban al amanecer. Pero cuando el Rey Brujo cayó, su última maldición buscó refugio en las raíces más profundas del bosque, corrompiendo todo a su paso. Ahora los árboles susurran secretos que enloquecen a los viajeros, y las criaturas que lo habitan ya no son las de antes. Los Guardianes de Valdheim ofrecen una recompensa a quien llegue al corazón del bosque y descubra qué fue del antiguo druida Eldrin.',
      levelReq: 1, maxLevel: 10, duration: 20, energyCost: 10,
      steps: [
        {
          type: 'narrative', name: 'La Entrada del Bosque',
          description: 'Llegas al borde del Bosque Susurrante. El sol apenas penetra el espeso dosel de hojas retorcidas. El viento mueve las ramas produciendo un sonido que se asemeja a voces lejanas. Un cartel medio podrido reza: "Más allá de este punto, el bosque no perdona". El sendero se bifurca casi de inmediato.',
        },
        {
          type: 'choice', name: 'El Cruce de Caminos',
          description: 'Dos senderos se abren frente a ti. El de la izquierda es angosto y está cubierto de musgo brillante. El de la derecha es más ancho, pero huellas recientes de grandes garras marcan el barro.',
          choices: [
            { text: 'Tomar el sendero angosto y cubierto de musgo', nextStep: 2, flavor: 'El musgo brilla con una luz tenue, como si señalara el camino. Sientes una presencia antigua observándote.' },
            { text: 'Seguir las huellas de garras por el camino ancho', nextStep: 6, flavor: 'Las huellas son frescas. El olor a bestia se mezcla con el de la tierra húmeda.' },
          ],
        },
        {
          type: 'narrative', name: 'El Claro del Musgo Brillante',
          description: 'El sendero angosto te lleva a un claro bañado por una luz verdeazulada que emana del musgo en los árboles. En el centro, una figura encapuchada está de espaldas, aparentemente meditando. No parece haberte notado. O quizás espera que te acerques.',
        },
        {
          type: 'choice', name: 'El Meditante Misterioso',
          description: 'La figura no se mueve. El musgo brilla más intensamente a su alrededor. Puedes distinguir un báculo de madera retorcida apoyado a su lado.',
          choices: [
            { text: 'Saludar a la figura', nextStep: 4, flavor: 'Tu voz rompe el silencio. La figura se incorpora lentamente...' },
            { text: 'Tomar el báculo sigilosamente', nextStep: 4, flavor: 'Te acercas con cuidado, pero al tocar el báculo, una descarga de energía te sacude y despierta al druida.' },
          ],
        },
        {
          type: 'combat', name: 'El Druida Corrupto',
          description: 'La figura se da la vuelta. Es Eldrin, el antiguo druida, pero sus ojos son dos ascuas verdes. La corrupción del bosque lo ha consumido. "Otro títere del Rey Brujo...", susurra, y la tierra misma se levanta para atacarte.',
          enemies: [
            { name: 'Eldrin Corrupto', icon: '🧙', hp: 50, mp: 30, atk: 12, def: 4, dx: 10, ag: 8, level: 3, damageType: 'nature' },
            { name: 'Raíz Animada', icon: '🌿', hp: 30, mp: 0, atk: 8, def: 6, dx: 4, ag: 2, level: 2 },
          ],
        },
        {
          type: 'choice', name: 'El Camino al Corazón',
          description: 'Eldrin recupera la lucidez y te revela que la corrupción aún late en el corazón del bosque. La semilla que te entrega puede restaurarlo, pero primero debes llegar al altar.',
          choices: [
            { text: 'Seguir las indicaciones de Eldrin', nextStep: 10, flavor: 'La semilla palpita en tu mano mientras las raíces se apartan para mostrarte el camino.' },
          ],
        },
        {
          type: 'combat', name: 'Emboscada en el Camino Ancho',
          description: 'Las huellas te llevan directamente a una madriguera. Un oso de sombra emerge rugiendo, sus ojos son pozos de oscuridad.',
          enemies: [
            { name: 'Oso de Sombra', icon: '🐻', hp: 70, mp: 10, atk: 15, def: 8, dx: 6, ag: 6, level: 3, damageType: 'dark' },
          ],
        },
        {
          type: 'choice', name: 'La Cueva del Oso',
          description: 'Dentro de la madriguera del oso encuentras un cadáver reciente. Es un explorador de Valdheim. Junto a su mano hay un mapa marcado y una llave de bronce.',
          choices: [
            { text: 'Tomar el mapa y la llave', nextStep: 8, flavor: 'El mapa muestra un atajo al corazón del bosque y una marca con forma de árbol.' },
            { text: 'Enterrar al explorador y seguir el mapa', nextStep: 8, flavor: 'Le das sepultura bajo una roca. Te sentirás mejor con ello, y el mapa sigue siendo útil.' },
          ],
        },
        {
          type: 'reward', name: 'Tesoro del Explorador',
          description: 'Siguiendo el mapa llegas a un viejo roble con una cavidad en su tronco. Dentro encuentras una bolsa con monedas y una poción guardada para emergencias.',
          rewards: { gold: 30, ep: 10 },
        },
        {
          type: 'choice', name: 'La Ruta hacia el Altar',
          description: 'El mapa del explorador señala el corazón del bosque. La llave de bronce abre una antigua compuerta entre las raíces.',
          choices: [
            { text: 'Abrir la compuerta y avanzar', nextStep: 10, flavor: 'Tras la compuerta, las raíces convergen alrededor de un altar cubierto de símbolos.' },
          ],
        },
        {
          type: 'narrative', name: 'El Corazón del Bosque',
          description: 'Llegas al centro del bosque. Un árbol gigantesco, más grande que cualquier edificio de Valdheim, se alza ante ti. Su tronco está marcado con runas druídicas antiguas. En su base, un altar de piedra espera. Este es el lugar donde todo comenzó, y donde todo puede terminar.',
        },
        {
          type: 'combat', name: 'La Corrupción Primigenia',
          description: 'Del altar emerge una figura de sombra y maleza: el último vestigio de la maldición del Rey Brujo. "No puedes purificar lo que ya está podrido", ruge mientras las raíces del gran árbol se retuercen para atacarte.',
          enemies: [
            { name: 'Corrupción Primigenia', icon: '👾', hp: 90, mp: 40, atk: 18, def: 6, dx: 8, ag: 6, level: 4, damageType: 'dark' },
          ],
        },
        {
          type: 'narrative', name: 'El Bosque Renace',
          description: 'Con la corrupción derrotada, las runas del gran árbol brillan con una luz dorada. Depositas la semilla druídica en el altar y un brote nuevo se entrelaza con las raíces antiguas. El bosque entero parece suspirar en alivio: los colores regresan y los susurros cesan. Has devuelto la vida al Bosque Susurrante. Los Guardianes de Valdheim estarán orgullosos.',
        },
      ],
      rewards: { goldMin: 30, goldMax: 60, ep: 30, fame: 5, items: [{ itemId: 3, chance: 20, qty: 1 }], materials: [{ materialId: 4, chance: 40, qty: 1 }, { materialId: 1, chance: 60, qty: 3 }] },
      factionId: fm['guardianes-valdheim'] ?? null, factionRep: 15,
      minGoldReward: 30, maxGoldReward: 60, epReward: 30, fameReward: 5, isActive: true,
    },
    {
      name: 'Las Catacumbas Olvidadas',
      slug: 'catacumbas-olvidadas',
      icon: '💀',
      description: 'Bajo la ciudad vieja yacen túneles que guardan secretos que la iglesia quiere enterrar.',
      lore: 'Cuando la Catedral de Lumina se construyó hace tres siglos, los arquitectos descubrieron algo inquietante: ya había algo bajo tierra. Túneles que no aparecían en ningún plano, cámaras selladas con símbolos que ningún sacerdote podía identificar. La iglesia los selló y ordenó olvidarlos. Pero los sellos se están debilitando, y de las profundidades se escuchan pasos que suben. El Sumo Sacerdote ha solicitado discretamente a aventureros que investiguen... y silencien lo que encuentren.',
      levelReq: 5, maxLevel: 20, duration: 25, energyCost: 15,
      steps: [
        {
          type: 'narrative', name: 'La Grieta en la Cripta',
          description: 'Accedes a las catacumbas por una entrada que la iglesia creía sellada. La escalera de caracol desciende más de lo que debería. El aire se vuelve pesado, cargado de polvo de siglos y algo más... un olor a incienso quemado mezclado con sangre seca. Al llegar al fondo, tres pasillos se abren ante ti. Grabados en la pared, un mensaje en latín antiguo: "Elige tu destino, pues la muerte no espera indecisos".',
        },
        {
          type: 'choice', name: 'Tres Caminos',
          description: 'El pasillo de la izquierda tiene marcas de garras en las paredes. El del centro está iluminado por antorchas que nunca se apagan. El de la derecha tiene un suelo cubierto de ceniza.',
          choices: [
            { text: 'El pasillo con marcas de garras', nextStep: 2, flavor: 'Las marcas son recientes. Grandes, como de algo que camina en dos patas pero tiene garras de bestia.' },
            { text: 'El pasillo iluminado con antorchas', nextStep: 3, flavor: 'Las antorchas parpadean con una llama azulada. El calor que desprenden es extrañamente frío.' },
            { text: 'El pasillo de ceniza', nextStep: 4, flavor: 'Cada paso levanta nubes de ceniza. Algo ardió aquí. Algo grande.' },
          ],
        },
        {
          type: 'combat', name: 'La Guarida de los Gnolls',
          description: 'El pasillo de las garras desemboca en una cámara donde un grupo de gnoll carroñeros ha hecho su guarida. Roen huesos humanos alrededor de una fogata. Al verte, muestran los colmillos.',
          enemies: [
            { name: 'Gnoll Carroñero', icon: '🐕', hp: 40, mp: 0, atk: 14, def: 5, dx: 8, ag: 8, level: 5 },
            { name: 'Gnoll Líder', icon: '🐺', hp: 55, mp: 5, atk: 17, def: 7, dx: 10, ag: 9, level: 6 },
            { name: 'Gnoll Rastreador', icon: '🐾', hp: 30, mp: 0, atk: 12, def: 3, dx: 14, ag: 12, level: 5 },
          ],
        },
        {
          type: 'narrative', name: 'Alijo Gnoll',
          description: 'Los gnolls saqueaban tumbas desde hace semanas. Entre sus pertenencias encuentras objetos de valor que robaron a los muertos.',
        },
        {
          type: 'reward', name: 'Botín de los Saqueadores',
          description: 'Recuperas una bolsa de monedas antiguas, un anillo de plata y un pergamino con un mapa parcial de las catacumbas.',
          rewards: { gold: 45, ep: 8, items: [{ itemId: 3, qty: 1 }] },
        },
        {
          type: 'choice', name: 'El Camino del Mapa',
          description: 'El mapa de las catacumbas marca dos rutas hacia la cámara central. Un camino corto pero peligroso, y otro largo pero supuestamente seguro.',
          choices: [
            { text: 'Tomar el atajo peligroso', nextStep: 6, flavor: 'El atajo cruza por una cámara que el mapa marca como "Sala de la Hambruna".' },
            { text: 'Ir por el camino largo', nextStep: 7, flavor: 'El camino largo rodea una fosa subterránea. Seguro, pero te tomará más tiempo.' },
          ],
        },
        {
          type: 'combat', name: 'Sala de la Hambruna',
          description: 'La cámara está llena de esqueletos que se retuercen al sentir tu presencia. Sus mandíbulas castañetean hambrientas, alzando armas oxidadas.',
          enemies: [
            { name: 'Esqueleto Hambriento', icon: '💀', hp: 35, mp: 0, atk: 11, def: 4, dx: 6, ag: 5, level: 5 },
            { name: 'Esqueleto Hambriento', icon: '💀', hp: 35, mp: 0, atk: 11, def: 4, dx: 6, ag: 5, level: 5 },
            { name: 'Esqueleto Capitán', icon: '⚔️', hp: 50, mp: 0, atk: 15, def: 8, dx: 8, ag: 6, level: 6 },
          ],
        },
        {
          type: 'narrative', name: 'La Fosa Subterránea',
          description: 'El camino largo bordea una fosa natural donde el agua gotea desde el techo. El sonido reverbera en la oscuridad. Cruzas por un puente de piedra estrecho que cruje bajo tus pies. Del otro lado, una puerta de hierro con un acertijo grabado te espera.',
        },
        {
          type: 'choice', name: 'El Acertijo de Hierro',
          description: 'La puerta tiene grabado: "No tengo voz, pero hablo. No tengo piernas, pero camino. No estoy vivo, pero crezco. ¿Qué soy?"',
          choices: [
            { text: '"El fuego"', nextStep: 12, flavor: 'Las runas en la puerta brillan en rojo. La puerta se abre lentamente...' },
            { text: '"La sombra"', nextStep: 11, flavor: 'La puerta no se mueve. Pero escuchas un rugido detrás de ti.' },
            { text: '"El río"', nextStep: 10, flavor: 'Las runas parpadean. La puerta parece dudar...' },
          ],
        },
        {
          type: 'narrative', name: 'Respuesta Correcta',
          description: '"No tengo voz, pero hablo. No tengo piernas, pero camino. No estoy vivo, pero crezco." La respuesta es "el fuego". La puerta de hierro se abre con un chirrido, revelando la cámara central más allá.',
        },
        {
          type: 'combat', name: 'El Guardián de Hierro',
          description: 'La respuesta incorrecta activa el mecanismo de defensa. Un golem de hierro se desprende de la pared para impedirte avanzar.',
          enemies: [
            { name: 'Gólem de Hierro', icon: '🗿', hp: 80, mp: 0, atk: 18, def: 14, dx: 4, ag: 2, level: 7 },
          ],
        },
        {
          type: 'combat', name: 'La Ira de las Catacumbas',
          description: 'El guardián espiritual despierta y emerge de las paredes; su forma etérea llena la cámara de un frío penetrante.',
          enemies: [
            { name: 'Espectro Guardián', icon: '👻', hp: 60, mp: 40, atk: 20, def: 5, dx: 12, ag: 10, level: 7, damageType: 'dark' },
          ],
        },
        {
          type: 'narrative', name: 'La Cámara del Primer Obispo',
          description: 'La cámara central es una capilla subterránea. En el altar, el esqueleto de un obispo está arrodillado, sosteniendo un libro abierto. Las paredes están cubiertas de frescos que cuentan una historia que la iglesia nunca reveló: aquí abajo no enterraban muertos, escondían algo vivo. El obispo fue su último guardián.',
        },
        {
          type: 'choice', name: 'El Libro del Obispo',
          description: 'El libro del obispo contiene ritos de sellado y una última página en blanco. Frente al altar, hay dos objetos: un incensario de oro y un cuchillo de obsidiana.',
          choices: [
            { text: 'Tomar el incensario y realizar el rito de sellado', nextStep: 14, flavor: 'El incienso arde con una luz blanca. Las paredes tiemblan mientras el sello se refuerza.' },
            { text: 'Tomar el cuchillo de obsidiana', nextStep: 15, flavor: 'El cuchillo vibra en tu mano. Algo despierta en las profundidades bajo la capilla.' },
          ],
        },
        {
          type: 'narrative', name: 'El Sello Restaurado',
          description: 'El rito funciona. Una onda de energía recorre las catacumbas, y por primera vez en siglos, el silencio verdadero reina bajo la catedral. El libro se cierra solo, y el esqueleto del obispo se deshace en polvo, su deber finalmente cumplido. Has hecho lo que la iglesia no pudo: has vuelto a sellar lo que sea que yace abajo.',
        },
        {
          type: 'reward', name: 'Recompensa del Obispo',
          description: 'Al deshacerse el esqueleto, queda un anillo episcopal de oro y zafiro. Vale una fortuna.',
          rewards: { gold: 80, ep: 15, fame: 5 },
        },
        {
          type: 'combat', name: 'Lo Que Despierta Abajo',
          description: 'El cuchillo de obsidiana era la llave de un sello más profundo. El suelo se abre y una criatura de pesadilla emerge: un vestigio del Rey Brujo, encadenado pero no vencido. "Gracias por las llaves, mortal..."',
          enemies: [
            { name: 'Vestigio del Rey Brujo', icon: '👑', hp: 120, mp: 60, atk: 22, def: 10, dx: 10, ag: 8, level: 9, damageType: 'dark' },
          ],
        },
        {
          type: 'narrative', name: 'El Precio de la Curiosidad',
          description: 'Derrotas al vestigio, pero el daño está hecho. El sello original está roto. La iglesia tendrá que enviar a sus mejores exorcistas. Pero al menos has contenido la amenaza... por ahora. Guardas el cuchillo de obsidiana como prueba y advertencia.',
        },
        {
          type: 'reward', name: 'Trofeo de Guerra',
          description: 'Del vestigio derrotado recoges un fragmento de sombra sólida, un material raro que los herreros del norte pagan bien.',
          rewards: { gold: 60, ep: 20, fame: 8, materials: [{ materialId: 7, qty: 1 }] },
        },
      ],
      rewards: { goldMin: 50, goldMax: 120, ep: 45, fame: 6, items: [{ itemId: 4, chance: 20, qty: 1 }], materials: [{ materialId: 2, chance: 50, qty: 3 }, { materialId: 5, chance: 30, qty: 1 }] },
      factionId: null, factionRep: 0,
      minGoldReward: 50, maxGoldReward: 120, epReward: 45, fameReward: 6, isActive: true,
    },
    {
      name: 'Los Picos Helados',
      slug: 'picos-helados',
      icon: '🏔️',
      description: 'Las montañas del norte guardan las ruinas de un templo draconiano y el tesoro de los antiguos reyes de hielo.',
      lore: 'Antes de que los clanes del norte se asentaran en los valles, los dragones de hielo gobernaban estas montañas. Su rey, Frostvorn, construyó un templo en la cima más alta, donde los vientos cuentan historias de batallas entre dragones y gigantes. Los herreros del norte hablan de un martillo legendario forjado con el corazón de un dragón, el Rompehielos, que yace en las profundidades del templo. Quien lo empuñe, dicen, tendrá el poder de unificar los clanes. O de destruirlos.',
      levelReq: 12, maxLevel: 30, duration: 30, energyCost: 20,
      steps: [
        {
          type: 'narrative', name: 'El Campamento Base',
          description: 'Llegas al último campamento antes de la ascensión. Los cazadores de la Hermandad del Norte te miran con respeto y escepticismo. "El templo se ha tragado a tres expediciones este año", gruñe una mujer barbuda señalando la cumbre. "Si tienes lo que hay que tener, el viejo Bjorn te vende provisiones. Si no, vuelve al sur antes de que el invierno te atrape." Las nubes se arremolinan alrededor del pico, y un trueno retumba en la distancia.',
        },
        {
          type: 'choice', name: 'Preparativos de Ascensión',
          description: 'Bjorn el Viejo tiene su puesto en el campamento. Sobre su mostrador: cuerdas resistentes, antorchas especiales que queman incluso en tormenta, y un mapa hecho con piel de yeti. También hay un báculo de madera blanca con runas grabadas.',
          choices: [
            { text: 'Comprar las cuerdas y antorchas', nextStep: 2, flavor: 'Bjorn asiente con aprobación. "Sabio. La montaña no perdona a los imprudentes."' },
            { text: 'Comprar el mapa y el báculo rúnico', nextStep: 3, flavor: 'Bjorn duda antes de venderte el báculo. "Eso perteneció al último mago que intentó la cumbre. Que tengas más suerte."' },
            { text: 'Aceptar la ayuda de una cazadora local', nextStep: 4, flavor: 'Una joven con pieles blancas se acerca. "Yo conozco un camino que no está en ningún mapa."' },
          ],
        },
        {
          type: 'combat', name: 'Viento Cortante',
          description: 'La tormenta te alcanza en la ladera. Entre el viento blanco, formas se mueven. Lobos de hielo, sus pelajes tan pálidos como la nieve, te rodean en silencio.',
          enemies: [
            { name: 'Lobo de Hielo', icon: '🐺', hp: 55, mp: 5, atk: 18, def: 7, dx: 12, ag: 14, level: 12 },
            { name: 'Lobo de Hielo', icon: '🐺', hp: 55, mp: 5, atk: 18, def: 7, dx: 12, ag: 14, level: 12 },
            { name: 'Lobo Alfa', icon: '🐺', hp: 80, mp: 10, atk: 22, def: 10, dx: 14, ag: 16, level: 13 },
          ],
        },
        {
          type: 'reward', name: 'Supervivencia en la Tormenta',
          description: 'Derrotas a los lobos y encuentras refugio en una cueva. Dentro hay restos de un campamento antiguo y una caja de suministros sellada.',
          rewards: { gold: 25, ep: 10, materials: [{ materialId: 3, qty: 2 }] },
        },
        {
          type: 'narrative', name: 'El Camino del Mago',
          description: 'El báculo rúnico te guía por un camino oculto que los mapas convencionales no marcan: un puente de hielo natural que cruza un abismo profundo. Las runas brillan cuando te acercas al borde. Del otro lado, la entrada al templo te espera, custodiada por estatuas de dragones que parecen observarte.',
        },
        {
          type: 'reward', name: 'El Legado del Mago',
          description: 'En el camino, encuentras el campamento del mago anterior. Sus diarios revelan secretos del templo y una bolsa con monedas antiguas.',
          rewards: { gold: 50, ep: 12 },
        },
        {
          type: 'choice', name: 'La Guía del Norte',
          description: 'Sigrid, la cazadora, conoce un secreto: un paso de gigantes que los dragones no sellaron. "A cambio, quiero una parte del tesoro. Trato justo."',
          choices: [
            { text: 'Aceptar el trato de Sigrid', nextStep: 6, flavor: '"Sabia decisión. Los gigantes dejaron marcas en las rocas. Yo sé leerlas."' },
            { text: 'Rechazar e ir por tu cuenta', nextStep: 7, flavor: '"Como quieras. Pero recuerda: la montaña siempre cobra su precio."' },
          ],
        },
        {
          type: 'narrative', name: 'El Paso de los Gigantes',
          description: 'Sigrid te guía por un antiguo camino de gigantes, escalones tallados en la roca viva. Las marcas en las paredes cuentan una batalla olvidada: gigantes contra dragones. Llegáis a una entrada lateral del templo, sin guardianes. "Te espero aquí. Buena suerte."',
        },
        {
          type: 'reward', name: 'El Reparto de Sigrid',
          description: 'Sigrid señala un muro falso. Detrás, una cámara con cofres de los saqueos de los gigantes. Os repartís el botín.',
          rewards: { gold: 80, ep: 15, items: [{ itemId: 5, qty: 1 }] },
        },
        {
          type: 'combat', name: 'El Precio de la Soledad',
          description: 'Sin Sigrid, caes en una trampa de hielo. Dos yetis, alertados por tu torpeza, emergen de la nieve.',
          enemies: [
            { name: 'Yeti', icon: '❄️', hp: 90, mp: 5, atk: 20, def: 12, dx: 6, ag: 4, level: 13 },
            { name: 'Yeti', icon: '❄️', hp: 90, mp: 5, atk: 20, def: 12, dx: 6, ag: 4, level: 13 },
          ],
        },
        {
          type: 'narrative', name: 'La Entrada al Templo',
          description: 'Sea cual sea el camino que tomaste, llegas a la entrada del templo de Frostvorn. Puertas de hielo cristalino de diez metros de altura muestran relieves de dragones en batalla. El frío aquí es tan intenso que tu aliento se congela antes de caer. Las puertas están entreabiertas, como si alguien más hubiera entrado recientemente... o como si te estuvieran esperando.',
        },
        {
          type: 'choice', name: 'El Vestíbulo de Hielo',
          description: 'Dentro del templo, el vestíbulo tiene tres altares dedicados a aspectos del dragón: el Ala (sabiduría), la Garra (poder) y el Ojo (conocimiento). En cada altar hay un acertijo que, de resolverse, otorga una bendición. Pero solo puedes elegir uno.',
          choices: [
            { text: 'Resolver el acertijo del Ala', nextStep: 12, flavor: 'El acertijo del Ala trata sobre el viento y el tiempo. Sientes que la respuesta te dará visión más allá de lo visible.' },
            { text: 'Resolver el acertijo de la Garra', nextStep: 13, flavor: 'El acertijo de la Garra es sobre la fuerza y el sacrificio. El poder fluye hacia ti.' },
            { text: 'Resolver el acertijo del Ojo', nextStep: 13, flavor: 'El acertijo del Ojo es sobre la verdad y las mentiras. El conocimiento te envuelve.' },
          ],
        },
        {
          type: 'narrative', name: 'Bendición del Ala',
          description: 'Resuelves el acertijo del viento. Una ráfaga cálida te envuelve, y por un momento ves las líneas de energía del templo: sabes exactamente qué caminos evitar. Bendición de Frostvorn: Evitas todas las trampas restantes.',
        },
        {
          type: 'reward', name: 'Bendiciones del Dragón',
          description: 'Garras o conocimiento — ambas bendiciones fortalecen tu espíritu. Sientes el poder de Frostvorn recorriendo tus venas.',
          rewards: { ep: 20 },
        },
        {
          type: 'narrative', name: 'El Trono de Hielo',
          description: 'Llegas a la cámara del trono. Un esqueleto de dragón gigantesco yace en el centro, su costillar formando un arco sobre un pedestal de hielo negro. Sobre el pedestal, el martillo Rompehielos espera. Pero no estás solo. Un guerrero con armadura de escarcha está de pie frente al martillo. "Otro ambicioso. El Rompehielos me pertenece. Frostvorn me lo prometió."',
        },
        {
          type: 'choice', name: 'El Guerrero de Escarcha',
          description: 'El guerrero empuña un hacha de hielo. Su armadura está hecha de escamas de dragón. "Vete, o comparte el destino de los otros."',
          choices: [
            { text: 'Enfrentarlo en combate', nextStep: 16, flavor: 'Desenvainas tu arma. El guerrero sonríe. "Como todos los demás."' },
            { text: 'Negociar: el martillo para ti, el tesoro para él', nextStep: 15, flavor: 'El guerrero ríe. "¿Y qué me dices de la gloria? La gloria no se negocia."' },
            { text: 'Ofrecerle un duelo ceremonial por el martillo', nextStep: 17, flavor: 'El guerrero se detiene. "Un duelo... como en los tiempos antiguos. Acepto."' },
          ],
        },
        {
          type: 'combat', name: 'Guerra por el Rompehielos',
          description: 'El guerrero de escarcha carga contra ti con furia glaciar. Su hacha de hielo corta el aire con un silbido mortal.',
          enemies: [
            { name: 'Guerrero de Escarcha', icon: '⚔️', hp: 130, mp: 30, atk: 24, def: 14, dx: 10, ag: 8, level: 15, damageType: 'ice' },
            { name: 'Hacha de Hielo', icon: '🪓', hp: 40, mp: 0, atk: 28, def: 5, dx: 6, ag: 4, level: 14 },
          ],
        },
        {
          type: 'narrative', name: 'Duelo de Campeones',
          description: 'El guerrero acepta el duelo. Os enfrentáis en el círculo de hielo, bajo la mirada vacía del esqueleto del dragón. Intercambiáis golpes, cada uno midiendo al otro. Es una lucha limpia, sin trucos. El mejor gana.',
        },
        {
          type: 'combat', name: 'Combate Singular',
          description: 'El duelo es cuerpo a cuerpo, sin cuartel. El guerrero es hábil, pero tú también.',
          enemies: [
            { name: 'Guerrero de Escarcha', icon: '⚔️', hp: 100, mp: 20, atk: 22, def: 12, dx: 12, ag: 10, level: 15, damageType: 'ice' },
          ],
        },
        {
          type: 'narrative', name: 'Victoria en la Cumbre',
          description: 'El guerrero cae de rodillas. "Mer... mérito tienes", jadea. "El Rompehielos es tuyo." Se leverta trabajosamente y se marcha por donde vino, dejándote solo frente al martillo legendario. Al empuñarlo, sientes el peso de siglos de historia draconiana. El hielo del templo cruje, pero no se rompe. La montaña te ha aceptado como digno portador del Rompehielos. Los herreros del norte te recibirán como a un héroe.',
        },
        {
          type: 'narrative', name: 'Negociación Fallida',
          description: '"No entiendes", dice el guerrero, su voz cargada de tristeza. "No se trata del tesoro ni del martillo. Se trata de lo que representa. Mientras yo guarde este lugar, Frostvorn vive en mí. Si te lo llevas... él muere de verdad." Suspira. "No puedo permitirlo." Y carga.',
        },
        {
          type: 'reward', name: 'El Rompehielos',
          description: 'El martillo es tuyo. Pesa más de lo que parece, y al sostenerlo sientes el poder del dragón de hielo recorrer tu brazo. Un herrero del norte podría hacer maravillas con esto.',
          rewards: { gold: 100, ep: 25, fame: 10, items: [{ itemId: 7, qty: 1 }] },
        },
      ],
      rewards: { goldMin: 120, goldMax: 250, ep: 70, fame: 10, items: [{ itemId: 7, chance: 25, qty: 1 }], materials: [{ materialId: 3, chance: 60, qty: 3 }, { materialId: 6, chance: 20, qty: 1 }] },
      factionId: fm['herreria-del-norte'] ?? null, factionRep: 20,
      minGoldReward: 120, maxGoldReward: 250, epReward: 70, fameReward: 10, isActive: true,
    },
  ]

  for (const a of adventures) {
    await db.adventure.upsert({
      where: { slug: a.slug },
      update: { steps: a.steps as Prisma.InputJsonValue },
      create: a as any,
    })
  }
}


