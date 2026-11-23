import { NextRequest, NextResponse } from "next/server"
import { requireHero } from "@/lib/auth-helpers"
import * as adventureService from "@/services/adventure.service"

export async function POST(req: NextRequest) {
  const result = await requireHero()
  if ("error" in result) return result.error
  const { heroId } = result

  const { heroAdventureId, expectedCurrentStep } = await req.json()
  if (!heroAdventureId || !Number.isInteger(expectedCurrentStep) || expectedCurrentStep < 0) {
    return NextResponse.json({ error: "Faltan parámetros válidos" }, { status: 400 })
  }

  try {
    const adventures = await adventureService.executeStep(heroId, heroAdventureId, expectedCurrentStep)
    return NextResponse.json(adventures)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
