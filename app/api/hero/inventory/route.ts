import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { $Enums } from '@/generated/prisma'
import logger from "@/lib/logger"
import { assertHeroItemNotListed } from "@/services/bazar-item-guard"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, {
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

  const insertedRuneIds = [...new Set(
    hero.items.flatMap(heroItem => (heroItem.runesIn as { itemId?: number }[] ?? [])
      .map(rune => rune.itemId)
      .filter((id): id is number => typeof id === "number" && Number.isInteger(id)))
  )]
  const insertedRunes = insertedRuneIds.length > 0
    ? await db.item.findMany({ where: { id: { in: insertedRuneIds } } })
    : []
  const insertedRuneById = new Map(insertedRunes.map(rune => [rune.id, rune]))

  return NextResponse.json(hero.items.map(heroItem => ({
    ...heroItem,
    resolvedRuneItems: (heroItem.runesIn as { itemId?: number; slotIndex?: number }[] ?? [])
      .flatMap(rune => {
        const resolved = typeof rune.itemId === "number" ? insertedRuneById.get(rune.itemId) : null
        return resolved ? [{ id: resolved.id, name: resolved.name, icon: resolved.icon, stats: resolved.stats, slotIndex: rune.slotIndex }] : []
      }),
  })))
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, {
    include: { skills: true, class: true, race: true },
  })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const { heroItemId, equipped } = await req.json()
  if (typeof heroItemId !== "string" || !heroItemId || typeof equipped !== 'boolean') {
    return NextResponse.json({ error: "heroItemId y equipped requeridos" }, { status: 400 })
  }

  try {
    return await db.$transaction(async tx => {
      await assertHeroItemNotListed(tx, heroItemId, hero.id)
      const heroItem = await tx.heroItem.findFirst({
        where: { id: heroItemId, heroId: hero.id },
        include: { item: true },
      })
      if (!heroItem) return NextResponse.json({ error: "Item no encontrado" }, { status: 404 })

      if (equipped) return handleEquip(tx, hero, heroItem)
      return handleUnequip(tx, hero, heroItem)
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : ""
    if (code === "ITEM_LISTED") {
      return NextResponse.json({ error: "No podés equipar ni desequipar un objeto mientras esté publicado en el bazar." }, { status: 409 })
    }
    if (code === "ITEM_NOT_FOUND") {
      return NextResponse.json({ error: "Item no encontrado" }, { status: 404 })
    }
    logger.error('inventory', 'Error equip/unequip:', error)
    return NextResponse.json({ error: 'Error al equipar/desequipar' }, { status: 500 })
  }
}

async function handleEquip(tx: any, hero: any, heroItem: any) {
  const item = heroItem.item

  if (item.category === 'consumable') {
    return NextResponse.json({ error: "No podés equipar consumibles" }, { status: 400 })
  }

  const errors = await validateRequirements(hero, item)
  if (errors.length > 0) {
    return NextResponse.json({ error: errors.join('. ') }, { status: 400 })
  }

  if (item.slot) {
    await resolveSlotConflict(tx, hero, item, heroItem)
  } else if (item.category === 'accessory') {
    const limitError = await checkAccessoryLimit(tx, hero)
    if (limitError) return limitError
  }

  if (item.slot === 'backpack') {
    await tx.hero.update({
      where: { id: hero.id },
      data: { inventoryMaxSize: Math.max(20, (hero.inventoryMaxSize ?? 20) + 15) },
    })
  }

  await tx.heroItem.update({
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

async function resolveSlotConflict(tx: any, hero: any, item: any, heroItem: any) {
  const conflictSlots = item.twoHanded
    ? (['mainHand', 'offHand'] as $Enums.EquipmentSlot[])
    : ([item.slot] as $Enums.EquipmentSlot[])
  const conflicts = await tx.heroItem.findMany({
    where: { heroId: hero.id, equipped: true, slot: { in: conflictSlots }, id: { not: heroItem.id } },
  })
  if (conflicts.length > 0) {
    await tx.heroItem.updateMany({
      where: { id: { in: conflicts.map(c => c.id) } },
      data: { equipped: false, slot: null },
    })
  }
}

async function checkAccessoryLimit(tx: any, hero: any) {
  const equippedAccessories = await tx.heroItem.count({
    where: { heroId: hero.id, equipped: true, item: { category: 'accessory' } },
  })
  if (equippedAccessories >= 4) {
    return NextResponse.json({ error: "Máximo 4 accesorios equipados" }, { status: 400 })
  }
  return null
}

async function handleUnequip(tx: any, hero: any, heroItem: any) {
  const wasBackpack = heroItem.slot === 'backpack'

  await tx.heroItem.update({
    where: { id: heroItem.id },
    data: { equipped: false, slot: null },
  })

  if (wasBackpack) {
    const currentSize = hero.inventoryMaxSize ?? 20
    const newSize = Math.max(20, currentSize - 15)
    await tx.hero.update({
      where: { id: hero.id },
      data: { inventoryMaxSize: newSize },
    })
  }

  return NextResponse.json({ success: true })
}
