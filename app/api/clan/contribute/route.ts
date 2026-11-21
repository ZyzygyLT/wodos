import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, { include: { clanMember: true } })
  if (!hero?.clanMember) {
    return NextResponse.json({ error: "No perteneces a un clan" }, { status: 400 })
  }

  const { amount } = await req.json()
  if (!Number.isInteger(amount) || amount < 1) {
    return NextResponse.json({ error: "Monto inválido" }, { status: 400 })
  }
  try {
    await db.$transaction(async tx => {
      const debit = await tx.hero.updateMany({
        where: { id: hero.id, gold: { gte: amount } },
        data: { gold: { decrement: amount } },
      })
      if (debit.count !== 1) throw new Error("CONTRIBUTION_INSUFFICIENT_GOLD")

      await tx.clan.update({
        where: { id: hero.clanMember!.clanId },
        data: { gold: { increment: amount } },
      })
      await tx.clanMember.update({
        where: { heroId: hero.id },
        data: { goldContributed: { increment: amount } },
      })
    })
  } catch (error) {
    if (error instanceof Error && error.message === "CONTRIBUTION_INSUFFICIENT_GOLD") {
      return NextResponse.json({ error: "Oro insuficiente" }, { status: 400 })
    }
    throw error
  }

  return NextResponse.json({ success: true, contributed: amount })
}
