import { NextRequest, NextResponse } from "next/server"
import { requireHero } from "@/lib/auth-helpers"
import * as adventureService from "@/services/adventure.service"

export async function POST(req: NextRequest) {
  const result = await requireHero()
  if ("error" in result) return result.error
  const { heroId } = result

  const { heroAdventureId } = await req.json()
  if (!heroAdventureId) return NextResponse.json({ error: "Falta heroAdventureId" }, { status: 400 })

  try {
    const adventures = await adventureService.claimRewards(heroId, heroAdventureId)
    return NextResponse.json(adventures)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
