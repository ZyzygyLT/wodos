import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { calcHpMax, calcMpMax, HeroAttrs } from "@/lib/combat-engine/formulas"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"

const VALID_ATTRS = ["st", "co", "in", "dx", "ch", "ag", "pe", "wi"] as const

const schema = z.object({
  attr: z.enum(VALID_ATTRS),
  amount: z.number().int().min(-5).max(5).refine(n => n !== 0, { message: "Amount must be non-zero" }),
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

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const hero = await db.hero.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (!hero) return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })

  const { attr, amount } = parsed.data
  const result = await db.$transaction(async tx => {
    // One lock protects attribute points, EP and derived HP/MP from concurrent edits.
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${hero.id} FOR UPDATE`

    const currentHero = await tx.hero.findUnique({
      where: { id: hero.id },
      select: {
        id: true, level: true, attrs: true, epTotal: true, epSpent: true,
        freeAttrPoints: true, hpCurrent: true, hpMax: true, mpCurrent: true, mpMax: true,
      },
    })
    if (!currentHero) throw new Error("HERO_NOT_FOUND")

    const attrs = (currentHero.attrs ?? {}) as Record<string, number>
    const currentVal = attrs[attr] || 0

    if (amount < 0) {
      const absAmount = Math.abs(amount)
      const newVal = Math.max(0, currentVal - absAmount)
      const pointsRemoved = currentVal - newVal
      let refundEp = 0
      for (let i = 0; i < pointsRemoved; i++) {
        refundEp += attrCost(newVal + i)
      }
      const actualRefundEp = Math.min(refundEp, currentHero.epSpent)
      const restoreFree = currentHero.freeAttrPoints < 5
        ? Math.min(5 - currentHero.freeAttrPoints, absAmount)
        : 0

      const newAttrs: Record<string, number> = { ...attrs, [attr]: newVal }
      const newHpMax = calcHpMax(newAttrs as unknown as HeroAttrs, currentHero.level)
      const newMpMax = calcMpMax(newAttrs as unknown as HeroAttrs)

      const updated = await tx.hero.updateMany({
        where: { id: hero.id, epSpent: { gte: actualRefundEp } },
        data: {
          attrs: newAttrs,
          hpMax: newHpMax,
          mpMax: newMpMax,
          hpCurrent: Math.min(currentHero.hpCurrent, newHpMax),
          mpCurrent: Math.min(currentHero.mpCurrent, newMpMax),
          epSpent: { decrement: actualRefundEp },
          ...(restoreFree > 0 ? { freeAttrPoints: { increment: restoreFree } } : {}),
        },
      })
      if (updated.count !== 1) throw new Error("ATTRIBUTE_BALANCE_STALE")

      return {
        attr,
        newValue: newVal,
        epRefund: actualRefundEp,
        freeRemaining: currentHero.freeAttrPoints + restoreFree,
        epRemaining: (currentHero.epTotal - currentHero.epSpent) + actualRefundEp,
        hpMax: newHpMax,
        mpMax: newMpMax,
        attrs: newAttrs,
      }
    }

    let remaining = amount
    const freeUsed = Math.min(remaining, currentHero.freeAttrPoints)
    remaining -= freeUsed

    let epCost = 0
    if (remaining > 0) {
      const spendStart = currentVal + freeUsed
      for (let i = 0; i < remaining; i++) {
        epCost += attrCost(spendStart + i)
      }
    }

    const epAvailable = currentHero.epTotal - currentHero.epSpent
    if (epAvailable < epCost) {
      throw new Error("EP_INSUFFICIENT")
    }

    const newAttrs: Record<string, number> = { ...attrs, [attr]: currentVal + amount }
    const newHpMax = calcHpMax(newAttrs as unknown as HeroAttrs, currentHero.level)
    const newMpMax = calcMpMax(newAttrs as unknown as HeroAttrs)

    const updated = await tx.hero.updateMany({
      where: {
        id: hero.id,
        freeAttrPoints: { gte: freeUsed },
        epSpent: { lte: currentHero.epTotal - epCost },
      },
      data: {
        attrs: newAttrs,
        hpMax: newHpMax,
        mpMax: newMpMax,
        hpCurrent: Math.min(currentHero.hpCurrent + (newHpMax - currentHero.hpMax), newHpMax),
        mpCurrent: Math.min(currentHero.mpCurrent + (newMpMax - currentHero.mpMax), newMpMax),
        ...(freeUsed > 0 ? { freeAttrPoints: { decrement: freeUsed } } : {}),
        ...(epCost > 0 ? { epSpent: { increment: epCost } } : {}),
      },
    })
    if (updated.count !== 1) throw new Error("ATTRIBUTE_BALANCE_STALE")

    return {
      attr,
      newValue: newAttrs[attr],
      freeUsed,
      freeRemaining: currentHero.freeAttrPoints - freeUsed,
      epCost,
      epRemaining: epAvailable - epCost,
      hpMax: newHpMax,
      mpMax: newMpMax,
      attrs: newAttrs,
    }
  }).catch(error => {
    if (!(error instanceof Error)) throw error
    if (error.message === "HERO_NOT_FOUND") {
      return { error: "No tenés un héroe", status: 404 }
    }
    if (error.message === "EP_INSUFFICIENT") {
      return { error: "EP insuficientes para realizar esta asignación", status: 400 }
    }
    if (error.message === "ATTRIBUTE_BALANCE_STALE") {
      return { error: "Los puntos o recursos cambiaron; volvé a intentarlo", status: 409 }
    }
    throw error
  })

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
