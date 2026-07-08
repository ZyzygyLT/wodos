import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { $Enums } from '@/generated/prisma/client'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      items: {
        include: { item: true },
        orderBy: { obtainedAt: 'desc' },
      },
    },
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  return NextResponse.json(hero.items)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { skills: true, class: true, race: true },
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const { heroItemId, equipped } = await req.json()
  if (!heroItemId || typeof equipped !== 'boolean') {
    return NextResponse.json({ error: "heroItemId y equipped requeridos" }, { status: 400 })
  }

  const heroItem = await db.heroItem.findUnique({
    where: { id: heroItemId },
    include: { item: true },
  })
  if (heroItem?.heroId !== hero.id) {
    return NextResponse.json({ error: "Item no encontrado" }, { status: 404 })
  }

  if (equipped) {
    return handleEquip(hero, heroItem)
  }

  return handleUnequip(hero, heroItem)
}

async function handleEquip(hero: any, heroItem: any) {
  const item = heroItem.item

  if (item.category === 'consumable') {
    return NextResponse.json({ error: "No podés equipar consumibles" }, { status: 400 })
  }

  const errors = await validateRequirements(hero, item)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('. ') }, { status: 400 })
  }

  if (item.slot) {
    await resolveSlotConflict(hero, item, heroItem)
  } else if (item.category === 'accessory') {
    const limitError = await checkAccessoryLimit(hero)
    if (limitError) return limitError
  }

  if (item.slot === 'backpack') {
    await db.hero.update({
      where: { id: hero.id },
      data: { inventoryMaxSize: Math.max(20, (hero.inventoryMaxSize ?? 20) + 15) },
    })
  }

  await db.heroItem.update({
    where: { id: heroItem.id },
    data: { equipped: true, slot: item.slot ?? null },
  })

  return NextResponse.json({ success: true })
}

async function validateRequirements(hero: any, item: any) {
  const errors: string[] = []
  checkLevelRequirement(hero, item, errors)
  checkClassRequirement(hero, item, errors)
  checkRaceRequirement(hero, item, errors)
  checkAttributeRequirements(hero, item, errors)
  await checkSkillRequirements(hero, item, errors)
  return errors
}

function checkLevelRequirement(hero: any, item: any, errors: string[]) {
  if (hero.level < item.levelReq) errors.push(`Requiere nivel ${item.levelReq}`)
}

function checkClassRequirement(hero: any, item: any, errors: string[]) {
  if (item.classReq.length > 0 && !item.classReq.includes(hero.classId)) errors.push(`Requiere clase: ${hero.class.name}`)
}

function checkRaceRequirement(hero: any, item: any, errors: string[]) {
  if (item.raceReq.length > 0 && !item.raceReq.includes(hero.raceId)) errors.push(`Requiere raza: ${hero.race.name}`)
}

function checkAttributeRequirements(hero: any, item: any, errors: string[]) {
  if (!item.attrReq) return
  const attrReq = item.attrReq as Record<string, number>
  const attrs = hero.attrs as Record<string, number>
  for (const [attr, min] of Object.entries(attrReq)) {
    if ((attrs[attr] ?? 0) < min) errors.push(`Requiere ${attr.toUpperCase()} ≥ ${min}`)
  }
}

async function checkSkillRequirements(hero: any, item: any, errors: string[]) {
  if (item.skillReq.length === 0) return
  const unlocked = new Set(hero.skills.map((s: any) => s.skillId))
  const needed = await db.skill.findMany({ where: { id: { in: item.skillReq } } })
  for (const sk of needed) {
    if (!unlocked.has(sk.id)) errors.push(`Requiere skill: ${sk.name}`)
  }
}

async function resolveSlotConflict(hero: any, item: any, heroItem: any) {
  const conflictSlots = item.twoHanded
    ? (['mainHand', 'offHand'] as $Enums.EquipmentSlot[])
    : ([item.slot] as $Enums.EquipmentSlot[])
  const conflicts = await db.heroItem.findMany({
    where: { heroId: hero.id, equipped: true, slot: { in: conflictSlots }, id: { not: heroItem.id } },
  })
  if (conflicts.length > 0) {
    await db.heroItem.updateMany({
      where: { id: { in: conflicts.map(c => c.id) } },
      data: { equipped: false, slot: null },
    })
  }
}

async function checkAccessoryLimit(hero: any) {
  const equippedAccessories = await db.heroItem.count({
    where: { heroId: hero.id, equipped: true, item: { category: 'accessory' } },
  })
  if (equippedAccessories >= 4) {
    return NextResponse.json({ error: "Máximo 4 accesorios equipados" }, { status: 400 })
  }
  return null
}

async function handleUnequip(hero: any, heroItem: any) {
  const wasBackpack = heroItem.slot === 'backpack'

  await db.heroItem.update({
    where: { id: heroItem.id },
    data: { equipped: false, slot: null },
  })

  if (wasBackpack) {
    const currentSize = hero.inventoryMaxSize ?? 20
    const newSize = Math.max(20, currentSize - 15)
    await db.hero.update({
      where: { id: hero.id },
      data: { inventoryMaxSize: newSize },
    })
  }

  return NextResponse.json({ success: true })
}
