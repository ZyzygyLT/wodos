import { NextRequest, NextResponse } from "next/server"
import { requireHero } from "@/lib/auth-helpers"
import * as adventureService from "@/services/adventure.service"

export async function GET() {
  const result = await requireHero()
  if ("error" in result) return result.error
  const { heroId } = result

  try {
    const adventures = await adventureService.listAdventures(heroId)
    return NextResponse.json(adventures)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const result = await requireHero()
  if ("error" in result) return result.error
  const { heroId } = result

  const { adventureId } = await req.json()
  if (!adventureId) return NextResponse.json({ error: "Falta adventureId" }, { status: 400 })

  try {
    const adventures = await adventureService.startAdventure(heroId, adventureId)
    return NextResponse.json(adventures)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
