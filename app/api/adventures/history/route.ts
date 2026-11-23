import { NextResponse } from "next/server"
import { requireHero } from "@/lib/auth-helpers"
import db from "@/lib/db"

export async function GET() {
  const result = await requireHero()
  if ("error" in result) return result.error
  const { heroId } = result

  const history = await db.heroAdventure.findMany({
    where: { heroId, status: { in: ["completed", "failed", "claimed"] } },
    include: {
      adventure: { select: { name: true, icon: true, description: true, levelReq: true } },
    },
    orderBy: { startedAt: "desc" },
    take: 20,
  })

  return NextResponse.json({
    history: history.map(h => ({
      id: h.id,
      adventureName: h.adventure.name,
      adventureIcon: h.adventure.icon,
      adventureDescription: h.adventure.description,
      status: h.status,
      outcome: h.result && typeof h.result === "object" && !Array.isArray(h.result)
        ? (h.result as { outcome?: string }).outcome ?? null
        : null,
      startedAt: h.startedAt,
      completedAt: h.completedAt,
      totalSteps: h.totalSteps,
      energySpent: h.energySpent,
    })),
  })
}
