import { NextRequest, NextResponse } from "next/server"
import db from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"
import { checkRateLimit, ipKey } from "@/lib/rate-limit"
import { formatZodError } from "@/lib/zod-error"

const schema = z.object({
  email: z.string().min(1).max(254).regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email"),
  password: z.string().min(8),
  name: z.string().min(2).max(30),
})

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`register:${ipKey(req)}`, 10, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: "Demasiadas peticiones. Intentá de nuevo en un minuto." }, { status: 429 })
  }

  const body = await req.json()
  const parsed = schema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const { email, password, name } = parsed.data

  const exists = await db.user.findUnique({ where: { email } })
  if (exists) {
    return NextResponse.json({ error: "Email ya registrado" }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await db.user.create({
    data: { email, name, passwordHash }
  })

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 })
}
