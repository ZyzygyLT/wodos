import { NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { getActiveHeroByUserId } from "@/lib/hero-utils"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await getActiveHeroByUserId(session.user.id, { include: {
      group: {
        include: {
          clan: { select: { name: true } },
          members: { include: { hero: { select: { name: true } } }, take: 5 },
        },
      },
    },
    orderBy: { createdAt: "desc" } })

  return NextResponse.json(invites)
}
