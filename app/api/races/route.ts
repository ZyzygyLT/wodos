import { NextResponse } from "next/server"
import db from "@/lib/db"

export async function GET() {
  const races = await db.race.findMany()
  return NextResponse.json(races)
}
