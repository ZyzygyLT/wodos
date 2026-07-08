import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { getDailyLoginStatus, claimDailyLogin } from "@/services/daily-login.service"

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const result = await getDailyLoginStatus(session.user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json(result.data)
}

export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const result = await claimDailyLogin(session.user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status ?? 500 })
  }

  return NextResponse.json(result.data)
}
