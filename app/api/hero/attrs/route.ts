import { NextRequest, NextResponse } from "next/server"
import type { Prisma } from "@/generated/prisma"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"
import { calcHpMax, calcMpMax, HeroAttrs } from "@/lib/combat-engine/formulas"
import {
  appendAttributeInvestments,
  refundAttributeInvestments,
} from "@/lib/attribute-investment-ledger"
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

  const hero = await getActiveHeroByUserId(session.user.id, { select: { id: true } })
  if (!hero) return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })

  const { attr, amount } = parsed.data
  const result = await db.$transaction(async tx => {
    // One lock protects attribute points, EP and derived HP/MP from concurrent edits.
    await tx.$queryRaw`SELECT "id" FROM "heroes" WHERE "id" = ${hero.id} FOR UPDATE`

    const currentHero = await tx.hero.findUnique({
      where: { id: hero.id },
      select: {
        id: true, level: true, attrs: true, epTotal: true, epSpent: true,
        freeAttrPoints: true, attrPointLedger: true,
        hpCurrent: true, hpMax: true, mpCurrent: true, mpMax: true,
      },
    })
    if (!currentHero) throw new Error("HERO_NOT_FOUND")

    const attrs = (currentHero.attrs ?? {}) as Record<string, number>
    const currentVal = attrs[attr] || 0

    if (amount < 0) {
      const pointsRemoved = Math.min(currentVal, Math.abs(amount))
      if (pointsRemoved < 1) throw new Error("ATTRIBUTE_MINIMUM")

      const refund = refundAttributeInvestments(currentHero.attrPointLedger, attr, pointsRemoved)
      if (!refund) throw new Error("ATTRIBUTE_REFUND_UNAVAILABLE")

      const newVal = currentVal - pointsRemoved
      const newAttrs: Record<string, number> = { ...attrs, [attr]: newVal }
      const newHpMax = calcHpMax(newAttrs as unknown as HeroAttrs, currentHero.level)
      const newMpMax = calcMpMax(newAttrs as unknown as HeroAttrs)

      const updated = await tx.hero.updateMany({
        where: { id: hero.id, epSpent: { gte: refund.epRefund } },
        data: {
          attrs: newAttrs,
          attrPointLedger: refund.ledger as Prisma.InputJsonValue,
          hpMax: newHpMax,
          mpMax: newMpMax,
          hpCurrent: Math.min(currentHero.hpCurrent, newHpMax),
          mpCurrent: Math.min(currentHero.mpCurrent, newMpMax),
          ...(refund.epRefund > 0 ? { epSpent: { decrement: refund.epRefund } } : {}),
          ...(refund.freeRefund > 0 ? { freeAttrPoints: { increment: refund.freeRefund } } : {}),
        },
      })
      if (updated.count !== 1) throw new Error("ATTRIBUTE_BALANCE_STALE")

      return {
        attr,
        newValue: newVal,
        epRefund: refund.epRefund,
        freeRefund: refund.freeRefund,
        freeRemaining: currentHero.freeAttrPoints + refund.freeRefund,
        epRemaining: (currentHero.epTotal - currentHero.epSpent) + refund.epRefund,
        hpMax: newHpMax,
        mpMax: newMpMax,
        attrs: newAttrs,
      }
    }

    let remaining = amount
    const freeUsed = Math.min(remaining, currentHero.freeAttrPoints)
    remaining -= freeUsed

    const epCosts: number[] = []
    if (remaining > 0) {
      const spendStart = currentVal + freeUsed
      for (let i = 0; i < remaining; i++) {
        epCosts.push(attrCost(spendStart + i))
      }
    }
    const epCost = epCosts.reduce((total, cost) => total + cost, 0)
    const ledger = appendAttributeInvestments(
      currentHero.attrPointLedger,
      attr,
      freeUsed,
      epCosts,
    )
    if (!ledger) throw new Error("ATTRIBUTE_LEDGER_INVALID")

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
        attrPointLedger: ledger as Prisma.InputJsonValue,
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
    if (error.message === "ATTRIBUTE_MINIMUM") {
      return { error: "El atributo ya está en su valor mínimo", status: 400 }
    }
    if (error.message === "ATTRIBUTE_REFUND_UNAVAILABLE") {
      return {
        error: "Este punto fue asignado antes del registro de inversiones y no se puede reembolsar.",
        status: 409,
      }
    }
    if (error.message === "ATTRIBUTE_LEDGER_INVALID") {
      return { error: "No se pudo verificar el historial de inversión del atributo", status: 409 }
    }
    if (error.message === "ATTRIBUTE_BALANCE_STALE") {
      return { error: "Los puntos o recursos cambiaron; volvé a intentarlo", status: 409 }
    }
    throw error
  })

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result)
}
