import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({
  host: '127.0.0.1', port: 5432, user: 'postgres', password: '1234', database: 'ironhold',
})
const adapter = new PrismaPg(pool)
const db = new PrismaClient({ adapter })

async function assignItems(heroId: string, itemSlugs: { slug: string; equipped?: boolean; slot?: string }[]) {
  const items = await db.item.findMany({ where: { slug: { in: itemSlugs.map(s => s.slug) } } })
  const itemMap = Object.fromEntries(items.map(i => [i.slug, i]))
  for (const s of itemSlugs) {
    const item = itemMap[s.slug]
    if (!item) { console.warn(`Item not found: ${s.slug}`); continue }
    await db.heroItem.create({
      data: { heroId, itemId: item.id, equipped: s.equipped ?? true, slot: (s.slot ?? item.slot) as any }
    })
  }
}

async function assignSkills(heroId: string, classSlug: string, tierUpTo: number) {
  const cls = await db.class.findUnique({ where: { slug: classSlug }, include: { skills: { where: { tier: { lte: tierUpTo } } } } })
  if (!cls) { console.warn(`Class not found: ${classSlug}`); return }
  for (const skill of cls.skills) {
    await db.heroSkill.upsert({
      where: { heroId_skillId: { heroId, skillId: skill.id } },
      update: {},
      create: { heroId, skillId: skill.id, rank: 1 }
    })
  }
  // Asignar skills defensivas genéricas (sin classId)
  const genericDefense = await db.skill.findMany({ where: { classId: null, defenseCategory: { not: null } } })
  for (const skill of genericDefense) {
    await db.heroSkill.upsert({
      where: { heroId_skillId: { heroId, skillId: skill.id } },
      update: {},
      create: { heroId, skillId: skill.id, rank: 1 }
    })
  }
  // Asignar skill defensiva de clase si existe y el nivel lo permite
  const classDefense = await db.skill.findFirst({ where: { classId: cls.id, defenseCategory: { not: null } } })
  if (classDefense) {
    if (tierUpTo >= 1 && (classSlug === 'guerrero' || tierUpTo >= 2)) {
      await db.heroSkill.upsert({
        where: { heroId_skillId: { heroId, skillId: classDefense.id } },
        update: {},
        create: { heroId, skillId: classDefense.id, rank: 1 }
      })
    }
  }
}

async function getDefenseDefaults(classSlug: string): Promise<Record<string, number | null>> {
  const generic = await db.skill.findMany({ where: { classId: null, defenseCategory: { not: null } } })
  const slugToId = Object.fromEntries(generic.map(s => [s.defenseCategory, s.id]))
  const classSkill = await db.skill.findFirst({ where: { class: { slug: classSlug }, defenseCategory: { not: null } } })
  if (classSlug === 'guerrero' && classSkill) {
    return { melee: classSkill.id, ranged: slugToId['ranged'] ?? null, magic: slugToId['magic'] ?? null }
  }
  if (classSlug === 'mago' && classSkill) {
    return { melee: slugToId['melee'] ?? null, ranged: slugToId['ranged'] ?? null, magic: classSkill.id }
  }
  if (classSlug === 'arquero' && classSkill) {
    return { melee: slugToId['melee'] ?? null, ranged: classSkill.id, magic: slugToId['magic'] ?? null }
  }
  return { melee: slugToId['melee'] ?? null, ranged: slugToId['ranged'] ?? null, magic: slugToId['magic'] ?? null }
}

async function createCombatProfile(heroId: string, position: string, classSlug: string) {
  const existing = await db.combatProfile.findFirst({ where: { heroId } })
  if (existing) return
  const defenseSkills = await getDefenseDefaults(classSlug)

  const heroSkills = await db.heroSkill.findMany({
    where: { heroId },
    include: { skill: true },
  })

  const attackSkill = heroSkills.find(hs =>
    ['attack', 'aoe_attack', 'armor_penetration', 'critical_attack'].includes(hs.skill.effect ?? '')
  )
  const healSkill = heroSkills.find(hs => hs.skill.effect === 'heal')
  const buffSkill = heroSkills.find(hs => hs.skill.effect === 'party_attack_up')

  const roundRules: any[] = []

  if (healSkill) {
    roundRules.push({
      priority: 1,
      condition: { type: 'hp_ally_lt', value: 50 },
      action: { skillId: healSkill.skill.id, targetPos: 'auto', targetType: 'most_injured_ally' },
    })
  }

  if (buffSkill && attackSkill) {
    roundRules.push({
      priority: 2,
      condition: { type: 'round_gt', value: 0 },
      action: { skillId: buffSkill.skill.id, targetPos: 'auto', targetType: 'self' },
    })
  }

  if (attackSkill) {
    roundRules.push({
      priority: 3,
      condition: { type: 'always' },
      action: { skillId: attackSkill.skill.id, targetPos: 'front', targetType: 'weakest' },
    })
  }

  if (roundRules.length === 0) {
    const fallback = heroSkills[0]
    if (fallback) {
      roundRules.push({
        priority: 1,
        condition: { type: 'always' },
        action: { skillId: fallback.skill.id, targetPos: 'front', targetType: 'weakest' },
      })
    }
  }

  await db.combatProfile.create({
    data: {
      heroId, name: 'Estándar', position: position as any,
      initiativeSkill: 'organization',
      defenseSkills: defenseSkills as any,
      roundRules: roundRules as any,
    },
  })
}

async function main() {
  console.log("Seeding test groups...")

  // ── 1. Admin user (debe existir del seed principal) ──
  const admin = await db.user.findUnique({ where: { email: 'admin@ironhold.com' } })
  if (!admin) {
    console.error("Admin user not found. Run the main seed first: npm run seed")
    process.exit(1)
  }

  const userId = admin.id

  // ── Limpiar héroes de test anteriores ──
  const existingHeroes = await db.hero.findMany({ where: { userId }, select: { id: true } })
  const existingIds = existingHeroes.map(h => h.id)
  if (existingIds.length > 0) {
    console.log(`  Limpiando ${existingIds.length} héroes previos...`)
    await db.groupMember.deleteMany({ where: { heroId: { in: existingIds } } })
    await db.clanMember.deleteMany({ where: { heroId: { in: existingIds } } })
    await db.combatProfile.deleteMany({ where: { heroId: { in: existingIds } } })
    await db.heroSkill.deleteMany({ where: { heroId: { in: existingIds } } })
    await db.heroItem.deleteMany({ where: { heroId: { in: existingIds } } })
    await db.heroMaterial.deleteMany({ where: { heroId: { in: existingIds } } })
    await db.heroQuest.deleteMany({ where: { heroId: { in: existingIds } } })
    await db.heroAchievement.deleteMany({ where: { heroId: { in: existingIds } } })
    await db.notification.deleteMany({ where: { heroId: { in: existingIds } } })
    await db.dungeonRun.deleteMany({ where: { heroId: { in: existingIds } } })
    await db.hero.deleteMany({ where: { id: { in: existingIds } } })
  }
  await db.clanGroup.deleteMany({ where: { clan: { name: 'Clan de Prueba' } } })
  await db.clanGroup.deleteMany({ where: { clanId: null, name: { in: ['Escuadrón Fénix', 'Lobos Solitarios'] } } })
  await db.clan.deleteMany({ where: { name: 'Clan de Prueba' } })

  const HERO_DEFS = [
    { name: "Aldric", classSlug: "guerrero", raceSlug: "borderlander", level: 10, frontliner: true, pos: "front" as const },
    { name: "Fiona", classSlug: "mago", raceSlug: "tirem-ag", level: 10, frontliner: false, pos: "rear" as const },
    { name: "Jorin", classSlug: "arquero", raceSlug: "targeshian", level: 9, frontliner: false, pos: "center" as const },
    { name: "Brom", classSlug: "guerrero", raceSlug: "mag-mor", level: 8, frontliner: true, pos: "front" as const },
    { name: "Nadia", classSlug: "mago", raceSlug: "tirem-ag", level: 8, frontliner: false, pos: "rear" as const },
    { name: "Kara", classSlug: "arquero", raceSlug: "halfling", level: 7, frontliner: false, pos: "center" as const },
    { name: "Orin", classSlug: "guerrero", raceSlug: "kargashian", level: 6, frontliner: true, pos: "front" as const },
    { name: "Sera", classSlug: "arquero", raceSlug: "halfling", level: 6, frontliner: false, pos: "center" as const },
    { name: "Dain", classSlug: "guerrero", raceSlug: "tirem-ag", level: 4, frontliner: true, pos: "front" as const },
    { name: "Petra", classSlug: "arquero", raceSlug: "targeshian", level: 4, frontliner: false, pos: "center" as const },
    // Grupo 3: Guardia de Élite (niveles 12–20)
    { name: "Siegfried", classSlug: "guerrero", raceSlug: "borderlander", level: 20, frontliner: true, pos: "front" as const },
    { name: "Elara", classSlug: "mago", raceSlug: "tirem-ag", level: 20, frontliner: false, pos: "rear" as const },
    { name: "Ragnar", classSlug: "guerrero", raceSlug: "kargashian", level: 18, frontliner: true, pos: "front" as const },
    { name: "Lyra", classSlug: "arquero", raceSlug: "halfling", level: 18, frontliner: false, pos: "rear" as const },
    { name: "Thorn", classSlug: "guerrero", raceSlug: "mag-mor", level: 16, frontliner: true, pos: "front" as const },
    { name: "Vega", classSlug: "mago", raceSlug: "tirem-ag", level: 16, frontliner: false, pos: "rear" as const },
    { name: "Kael", classSlug: "arquero", raceSlug: "targeshian", level: 12, frontliner: false, pos: "center" as const },
    { name: "Mira", classSlug: "guerrero", raceSlug: "borderlander", level: 12, frontliner: true, pos: "front" as const },
  ]

  const createdHeroIds: string[] = []
  const frontlinerIds: string[] = []
  const nonFrontIds: string[] = []

  const heroCreationResult = await createTestHeroes(HERO_DEFS, userId)
  createdHeroIds.push(...heroCreationResult.heroIds)
  frontlinerIds.push(...heroCreationResult.frontlinerIds)
  nonFrontIds.push(...heroCreationResult.nonFrontIds)

  // ── Equip items ──
  const gearMap: Record<string, { slug: string; slot: string }[]> = {
    guerrero: [
      { slug: "espada-hierro", slot: "mainHand" },
      { slug: "armadura-cuero", slot: "chest" },
      { slug: "cinturon-cuero", slot: "belt" },
    ],
    mago: [
      { slug: "baston-runico", slot: "mainHand" },
      { slug: "tunica-lino", slot: "chest" },
      { slug: "collar-huesos", slot: "neck" },
    ],
    arquero: [
      { slug: "arco-corto", slot: "mainHand" },
      { slug: "armadura-cuero", slot: "chest" },
      { slug: "brazales-cuero", slot: "arms" },
    ],
  }

  for (const hero of await db.hero.findMany({ where: { userId }, include: { class: true } })) {
    const gear = gearMap[hero.class.slug]
    if (gear) await assignItems(hero.id, gear)
  }

  // ── 3. Create a test clan and groups ──
  const testClan = await db.clan.upsert({
    where: { name: 'Clan de Prueba' },
    update: {},
    create: { name: 'Clan de Prueba', tag: 'TEST', icon: '🧪', description: 'Clan para pruebas', gold: 1000, fame: 0, level: 1 },
  })

  const groupDefs = [
    { name: 'Escuadrón Fénix', icon: '🔥', desc: 'Equipo balanceado de alto nivel' },
    { name: 'Lobos Solitarios', icon: '🐺', desc: 'Grupo de nivel medio' },
    { name: 'Guardia de Élite', icon: '🛡️', desc: 'Grupo de alto nivel' },
  ]

  const groupIds: string[] = []

  const GROUP_SIZES = [5, 5, 8]
  let heroOffset = 0
  for (let i = 0; i < groupDefs.length; i++) {
    const g = groupDefs[i]
    const group = await db.clanGroup.upsert({
      where: { clanId_name: { clanId: testClan.id, name: g.name } },
      update: { icon: g.icon },
      create: { clanId: testClan.id, name: g.name, icon: g.icon, leaderId: createdHeroIds[heroOffset] },
    })
    groupIds.push(group.id)
    heroOffset += GROUP_SIZES[i]
    console.log(`  Created group: ${g.name}`)
  }

  // ── 4. Assign heroes to groups ──
  const groupAssignments = groupDefs.map((_, i) => {
    const start = GROUP_SIZES.slice(0, i).reduce((a, b) => a + b, 0)
    return { groupIdx: i, heroIds: createdHeroIds.slice(start, start + GROUP_SIZES[i]) }
  })

  for (const assign of groupAssignments) {
    const groupId = groupIds[assign.groupIdx]
    for (let i = 0; i < assign.heroIds.length; i++) {
      const heroId = assign.heroIds[i]
      const role = i === 0 ? 'leader' as const : 'member' as const
      await db.clanMember.upsert({
        where: { heroId },
        update: { groupId, groupRole: role },
        create: { heroId, clanId: testClan.id, role: 'member', groupId, groupRole: role },
      })
    }
  }

  console.log(`\nDone! ${createdHeroIds.length} heroes, ${groupIds.length} groups.`)
  console.log(`Frontliners: ${frontlinerIds.length}, Non-frontliners: ${nonFrontIds.length}`)
}

async function createTestHeroes(defs: { name: string; classSlug: string; raceSlug: string; level: number; frontliner: boolean; pos: 'front' | 'center' | 'rear' }[], userId: string) {
  const heroIds: string[] = []
  const frontlinerIds: string[] = []
  const nonFrontIds: string[] = []

  for (const def of defs) {
    const cls = await db.class.findUnique({ where: { slug: def.classSlug } })
    const race = await db.race.findUnique({ where: { slug: def.raceSlug } })
    if (!cls || !race) { console.warn(`Class/race not found: ${def.classSlug}/${def.raceSlug}`); continue }

    const attrs = computeTestHeroAttrs(cls, race, def.level)
    const hpMax = def.level * 5 + (attrs.co ?? 5) * 10
    const mpBase = 20 + def.level * 5 + attrs.wi * 2
    const mpMax = mpBase + (cls.slug === 'mago' ? 20 : 0)
    const tierUp = tierForLevel(def.level)

    const hero = await db.hero.create({
      data: {
        userId, name: def.name, classId: cls.id, raceId: race.id,
        level: def.level, hpMax, mpMax, hpCurrent: hpMax, mpCurrent: mpMax,
        attrs, freeAttrPoints: 0,
        gold: 100 + def.level * 50, epTotal: def.level * 100, epSpent: 0,
        fame: def.level * 5, inventoryMaxSize: 20, onboardingDone: true,
      },
    })

    await assignSkills(hero.id, def.classSlug, tierUp)
    await createCombatProfile(hero.id, def.pos, def.classSlug)
    heroIds.push(hero.id)
    if (def.frontliner) frontlinerIds.push(hero.id)
    else nonFrontIds.push(hero.id)
    console.log(`  Created hero: ${def.name} (${def.classSlug} Lv${def.level})`)
  }

  return { heroIds, frontlinerIds, nonFrontIds }
}

function computeTestHeroAttrs(cls: any, race: any, level: number) {
  const classAttrs = cls.baseAttrs as Record<string, number>
  const raceMods = race.attrMods as Record<string, number>
  const attrs: Record<string, number> = {}
  const attrKeys = ['st', 'co', 'in', 'dx', 'ch', 'ag', 'pe', 'wi']
  for (const k of attrKeys) attrs[k] = (classAttrs[k] ?? 0) + (raceMods[k] ?? 0)

  const freePoints = Math.min(10 + level * 2, 40)
  attrs[cls.primaryAttr] += Math.floor(freePoints * 0.5)
  attrs[cls.secondaryAttr] += Math.floor(freePoints * 0.3)
  attrs['co'] = (attrs['co'] ?? 0) + (freePoints - Math.floor(freePoints * 0.5) - Math.floor(freePoints * 0.3))
  return attrs
}

function tierForLevel(level: number) {
  if (level >= 8) return 3
  if (level >= 5) return 2
  return 1
}

main().catch(e => { console.error(e); process.exit(1) })
