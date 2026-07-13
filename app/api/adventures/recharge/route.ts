import { NextResponse } from "next/server"
import { requireHero } from "@/lib/auth-helpers"
import * as adventureService from "@/services/adventure.service"

export async function POST() {
  const result = await requireHero()
  if ("error" in result) return result.error
  const { heroId } = result

  try {
    const adventures = await adventureService.rechargeEnergy(heroId)
    return NextResponse.json(adventures)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
