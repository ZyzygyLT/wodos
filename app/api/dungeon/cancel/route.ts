import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id)
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  if (!hero.dungeonRegisteredId) {
    return NextResponse.json({ error: "No estás registrado en ninguna mazmorra" }, { status: 400 })
  }

  await db.$transaction(async (tx) => {
    await tx.dungeonRun.update({
      where: { id: hero.dungeonRegisteredId! },
      data: { status: 'failed', result: 'defeat' },
    })

    await tx.hero.update({
      where: { id: hero.id },
      data: { dungeonRegisteredId: null },
    })
  })

  return NextResponse.json({ cancelled: true })
}
