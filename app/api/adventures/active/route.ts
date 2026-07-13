import { NextResponse } from "next/server"
import { requireHero } from "@/lib/auth-helpers"
import * as adventureService from "@/services/adventure.service"

export async function GET() {
  const result = await requireHero()
  if ("error" in result) return result.error
  const { heroId } = result

  try {
    const active = await adventureService.getActiveAdventure(heroId)
    return NextResponse.json(active ?? { active: false })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
