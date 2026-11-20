import { NextRequest, NextResponse } from "next/server"
import logger from "@/lib/logger"
import { auth } from "@/auth"
import db from "@/lib/db"
import { updateQuestProgress } from "@/lib/quests/progress"
import { checkAchievements } from "@/lib/achievements/checker"

type SocketEntry = { slotIndex: number; itemId: number }

function parseRunesIn(value: unknown): SocketEntry[] | null {
  if (!Array.isArray(value)) return null
  const entries: SocketEntry[] = []
  const usedSlots = new Set<number>()
  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !Number.isInteger(entry.slotIndex) ||
      entry.slotIndex < 0 ||
      !Number.isInteger(entry.itemId) ||
      entry.itemId <= 0 ||
      usedSlots.has(entry.slotIndex)
    ) return null
    usedSlots.add(entry.slotIndex)
    entries.push({ slotIndex: entry.slotIndex, itemId: entry.itemId })
  }
  return entries
}

async function lockHeroItems(tx: typeof db, ids: string[]) {
  // Lock rows in a stable order to serialize concurrent socket/unsocket requests.
  await tx.$queryRaw`SELECT id FROM hero_items WHERE id IN (${ids[0]}, ${ids[1] ?? ids[0]}) ORDER BY id FOR UPDATE`
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: {
      items: {
        where: { item: { category: "rune" } },
        include: { item: true },
      },
    },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  return NextResponse.json(hero.items)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  let body: { heroItemId?: unknown; slotIndex?: unknown; runeHeroItemId?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const { heroItemId, slotIndex, runeHeroItemId } = body
  if (
    typeof heroItemId !== "string" || !heroItemId ||
    typeof runeHeroItemId !== "string" || !runeHeroItemId ||
    !Number.isInteger(slotIndex) || (slotIndex as number) < 0
  ) {
    return NextResponse.json({ error: "heroItemId, slotIndex entero y runeHeroItemId requeridos" }, { status: 400 })
  }
  if (heroItemId === runeHeroItemId) {
    return NextResponse.json({ error: "El objeto y la runa deben ser distintos" }, { status: 400 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  try {
    await db.$transaction(async tx => {
      await lockHeroItems(tx, [heroItemId, runeHeroItemId])

      const target = await tx.heroItem.findFirst({
        where: { id: heroItemId, heroId: hero.id },
        include: { item: true },
      })
      if (!target) throw new Error("TARGET_NOT_FOUND")
      const runeSlots = target.item.runeSlots
      if (!Number.isInteger(runeSlots) || runeSlots <= 0) throw new Error("NO_RUNE_SLOTS")
      if ((slotIndex as number) >= runeSlots) throw new Error("INVALID_SLOT")

      const runesIn = parseRunesIn(target.runesIn)
      if (!runesIn) throw new Error("INVALID_RUNE_DATA")
      if (runesIn.some(rune => rune.slotIndex === slotIndex)) throw new Error("SLOT_OCCUPIED")

      const rune = await tx.heroItem.findFirst({
        where: { id: runeHeroItemId, heroId: hero.id },
        include: { item: true },
      })
      if (!rune || rune.item.category !== "rune") throw new Error("RUNE_NOT_FOUND")
      if (rune.equipped) throw new Error("RUNE_EQUIPPED")

      await tx.heroItem.update({
        where: { id: target.id },
        data: { runesIn: [...runesIn, { slotIndex: slotIndex as number, itemId: rune.itemId }] },
      })
      const deleted = await tx.heroItem.deleteMany({
        where: { id: rune.id, heroId: hero.id, equipped: false },
      })
      if (deleted.count !== 1) throw new Error("RUNE_STALE")
    })

    updateQuestProgress(hero.id, { type: "socket_rune" }).catch(e => logger.error("api", "Background operation failed", e))
    checkAchievements(hero.id, { type: "socket_rune" }).catch(e => logger.error("api", "Background operation failed", e))
    return NextResponse.json({ success: true })
  } catch (error) {
    const code = error instanceof Error ? error.message : ""
    const responses: Record<string, { error: string; status: number }> = {
      TARGET_NOT_FOUND: { error: "Item no encontrado", status: 404 },
      RUNE_NOT_FOUND: { error: "Runa no encontrada", status: 404 },
      NO_RUNE_SLOTS: { error: "Este objeto no tiene espacios para runas", status: 400 },
      INVALID_SLOT: { error: "Slot inválido", status: 400 },
      INVALID_RUNE_DATA: { error: "Los datos de runas del objeto son inválidos", status: 409 },
      SLOT_OCCUPIED: { error: "Slot ya ocupado", status: 409 },
      RUNE_EQUIPPED: { error: "De-equipá la runa primero", status: 400 },
      RUNE_STALE: { error: "La runa ya no está disponible", status: 409 },
    }
    const response = responses[code]
    if (response) return NextResponse.json({ error: response.error }, { status: response.status })
    logger.error("api", "Error socketing rune", error)
    return NextResponse.json({ error: "No se pudo insertar la runa" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  let body: { heroItemId?: unknown; slotIndex?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }
  const { heroItemId, slotIndex } = body
  if (
    typeof heroItemId !== "string" || !heroItemId ||
    !Number.isInteger(slotIndex) || (slotIndex as number) < 0
  ) {
    return NextResponse.json({ error: "heroItemId y slotIndex entero requeridos" }, { status: 400 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (!hero) return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })

  try {
    await db.$transaction(async tx => {
      await lockHeroItems(tx, [heroItemId])

      const target = await tx.heroItem.findFirst({
        where: { id: heroItemId, heroId: hero.id },
        include: { item: true },
      })
      if (!target) throw new Error("TARGET_NOT_FOUND")
      if (!Number.isInteger(target.item.runeSlots) || target.item.runeSlots <= 0 || (slotIndex as number) >= target.item.runeSlots) {
        throw new Error("INVALID_SLOT")
      }

      const runesIn = parseRunesIn(target.runesIn)
      if (!runesIn) throw new Error("INVALID_RUNE_DATA")
      const index = runesIn.findIndex(rune => rune.slotIndex === slotIndex)
      if (index === -1) throw new Error("SLOT_EMPTY")

      const [removed] = runesIn.splice(index, 1)
      await tx.heroItem.update({
        where: { id: target.id },
        data: { runesIn },
      })
      await tx.heroItem.create({
        data: { heroId: hero.id, itemId: removed.itemId, equipped: false },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    const code = error instanceof Error ? error.message : ""
    const responses: Record<string, { error: string; status: number }> = {
      TARGET_NOT_FOUND: { error: "Item no encontrado", status: 404 },
      INVALID_SLOT: { error: "Slot inválido", status: 400 },
      INVALID_RUNE_DATA: { error: "Los datos de runas del objeto son inválidos", status: 409 },
      SLOT_EMPTY: { error: "Slot vacío", status: 409 },
    }
    const response = responses[code]
    if (response) return NextResponse.json({ error: response.error }, { status: response.status })
    logger.error("api", "Error unsocketing rune", error)
    return NextResponse.json({ error: "No se pudo retirar la runa" }, { status: 500 })
  }
}
