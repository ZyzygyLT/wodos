import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { updateQuestProgress } from "@/lib/quests/progress"
import { checkAchievements } from "@/lib/achievements/checker"
import { notify } from "@/lib/notifications/emitter"
import { trackHeroEventProgress } from "@/services/event.service"
import { adjustRep } from "@/services/faction.service"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { materials: { include: { material: true } } },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const recipes = await db.item.findMany({
    where: { isCraftable: true },
  })

  const heroMaterials = new Map(hero.materials.map(m => [m.materialId, m.quantity]))
  const allMaterials = await db.material.findMany()

  const recipesWithStatus = recipes.map(item => {
    const recipe = item.recipe as { materials: { materialId: number; quantity: number }[]; goldCost: number } | null
    if (!recipe) return { ...item, canCraft: false, missingMaterials: [], goldCost: 0 }

    const missing: { name: string; icon: string; have: number; need: number }[] = []
    let canCraft = true

    for (const req of recipe.materials) {
      const have = heroMaterials.get(req.materialId) ?? 0
      if (have < req.quantity) {
        canCraft = false
        const mat = allMaterials.find(m => m.id === req.materialId)
        missing.push({
          name: mat?.name ?? `#${req.materialId}`,
          icon: mat?.icon ?? "📦",
          have,
          need: req.quantity,
        })
      }
    }

    if (hero.gold < recipe.goldCost) canCraft = false

    return {
      ...item,
      recipe,
      canCraft,
      missingMaterials: missing,
      heroGold: hero.gold,
      heroMaterials: hero.materials.map(m => ({
        id: m.materialId,
        name: m.material.name,
        icon: m.material.icon,
        quantity: m.quantity,
      })),
    }
  })

  return NextResponse.json({ recipes: recipesWithStatus })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const { itemId } = await req.json()
  if (!itemId) return NextResponse.json({ error: "Falta itemId" }, { status: 400 })

  const item = await db.item.findUnique({ where: { id: itemId } })
  if (!item?.isCraftable || !item.recipe) {
    return NextResponse.json({ error: "Item no crafteable" }, { status: 400 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    include: { materials: true, items: true },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  const recipe = item.recipe as { materials: { materialId: number; quantity: number }[]; goldCost: number }

  if (hero.gold < recipe.goldCost) {
    return NextResponse.json({ error: `Oro insuficiente. Necesitás ${recipe.goldCost}💰` }, { status: 400 })
  }

  const heroMatMap = new Map(hero.materials.map(m => [m.materialId, m]))
  for (const req of recipe.materials) {
    const hm = heroMatMap.get(req.materialId)
    if (!hm || hm.quantity < req.quantity) {
      return NextResponse.json({ error: "Materiales insuficientes" }, { status: 400 })
    }
  }

  await db.$transaction(async (tx) => {
    for (const req of recipe.materials) {
      await tx.heroMaterial.update({
        where: { heroId_materialId: { heroId: hero.id, materialId: req.materialId } },
        data: { quantity: { decrement: req.quantity } },
      })
    }
    await tx.hero.update({
      where: { id: hero.id },
      data: { gold: { decrement: recipe.goldCost } },
    })
    await tx.heroItem.create({
      data: { heroId: hero.id, itemId: item.id, equipped: false },
    })
  })

  updateQuestProgress(hero.id, { type: "craft_items" }).catch(() => {})
  checkAchievements(hero.id, { type: "craft_items" }).catch(() => {})
  trackHeroEventProgress(hero.id, "crafting", 1).catch(() => {})
  adjustRep(hero.id, 3, 5).catch(() => {}) // Gremio +5
  adjustRep(hero.id, 2, 2).catch(() => {}) // Mercaderes +2

  notify({
    heroId: hero.id,
    type: "item_crafted",
    title: "🔨 Item crafteado",
    body: `Creaste ${item.name}`,
    data: { itemId: item.id, itemName: item.name },
  }).catch(() => {})

  return NextResponse.json({ success: true, name: item.name })
}
