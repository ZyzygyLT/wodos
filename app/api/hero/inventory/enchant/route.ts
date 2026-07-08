import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkRateLimit, ipKey } from "@/lib/rate-limit"
import { processEnchant } from "@/services/enchant.service"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"

const schema = z.object({
  heroItemId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`enchant:${ipKey(req)}`, 20, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ error: "Demasiadas peticiones. Intentá de nuevo en un minuto." }, { status: 429 })
  }

  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })

  const result = await processEnchant(session.user.id, parsed.data.heroItemId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status ?? 400 })

  return NextResponse.json(result.data)
}
