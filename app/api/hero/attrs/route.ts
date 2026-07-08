import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { calcHpMax, calcMpMax, HeroAttrs } from "@/lib/combat-engine/formulas"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"

const VALID_ATTRS = ["st", "co", "in", "dx", "ch", "ag", "pe", "wi"] as const

const schema = z.object({
  attr: z.enum(VALID_ATTRS),
  amount: z.number().int().min(1).max(5),
})

function attrCost(currentValue: number): number {
  if (currentValue < 10) return 10
  if (currentValue < 15) return 15
  if (currentValue < 20) return 20
  return 30
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const { attr, amount } = parsed.data
  let attrs = hero.attrs as Record<string, number>
  const currentVal = attrs[attr] || 0

  let remaining = amount
  let freeUsed = 0
  let epCost = 0

  // 1) Gastar freeAttrPoints primero (gratis, 1:1)
  if (hero.freeAttrPoints > 0) {
    freeUsed = Math.min(remaining, hero.freeAttrPoints)
    remaining -= freeUsed
  }

  // 2) Lo que falta se paga con EP + curva de costo
  if (remaining > 0) {
    const spendStart = currentVal + freeUsed
    for (let i = 0; i < remaining; i++) {
      epCost += attrCost(spendStart + i)
    }
    const epAvailable = hero.epTotal - hero.epSpent
    if (epAvailable < epCost) {
      return NextResponse.json({
        error: `EP insuficientes. Necesitás ${epCost}, tenés ${epAvailable}`
      }, { status: 400 })
    }
  }

  const newAttrs: Record<string, number> = { ...attrs, [attr]: currentVal + amount }
  const newHpMax = calcHpMax(newAttrs as unknown as HeroAttrs, hero.level)
  const newMpMax = calcMpMax(newAttrs as unknown as HeroAttrs)

  const updateData: Record<string, any> = {
    attrs: newAttrs,
    hpMax: newHpMax,
    mpMax: newMpMax,
    hpCurrent: Math.min(hero.hpCurrent + (newHpMax - hero.hpMax), newHpMax),
    mpCurrent: Math.min(hero.mpCurrent + (newMpMax - hero.mpMax), newMpMax),
  }
  if (freeUsed > 0) updateData.freeAttrPoints = { decrement: freeUsed }
  if (epCost > 0) updateData.epSpent = { increment: epCost }

  await db.hero.update({
    where: { id: hero.id },
    data: updateData,
  })

  return NextResponse.json({
    attr,
    newValue: newAttrs[attr],
    freeUsed,
    freeRemaining: (hero.freeAttrPoints - freeUsed),
    epCost,
    epRemaining: (hero.epTotal - hero.epSpent) - epCost,
    hpMax: newHpMax,
    mpMax: newMpMax,
    attrs: newAttrs,
  })
}
