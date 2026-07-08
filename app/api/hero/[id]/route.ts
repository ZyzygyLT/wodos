import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"

const updateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  description: z.string().max(500).optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({
    where: { id, userId: session.user.id },
  })
  if (!hero) {
    return NextResponse.json({ error: "Héroe no encontrado" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const data: Record<string, any> = {}
  if (parsed.data.name) data.name = parsed.data.name
  if (parsed.data.description !== undefined) data.description = parsed.data.description

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 })
  }

  const updated = await db.hero.update({
    where: { id },
    data,
    select: { id: true, name: true, level: true },
  })

  return NextResponse.json(updated)
}
