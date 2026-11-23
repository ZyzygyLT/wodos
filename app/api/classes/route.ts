import { NextResponse } from "next/server"
import db from "@/lib/db"

export async function GET() {
  const classes = await db.class.findMany({
    orderBy: { tier: "asc" }
  })
  return NextResponse.json(classes)
}
