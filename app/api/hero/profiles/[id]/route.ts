import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import db from "@/lib/db"
import { z } from "zod"
import { formatZodError } from "@/lib/zod-error"

const renameSchema = z.object({
  name: z.string().min(1).max(40),
})

const updateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  position: z.enum(['front', 'center', 'rear', 'left_flank', 'right_flank', 'flexible']).optional(),
})

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const profile = await db.combatProfile.findUnique({ where: { id } })
  if (profile?.heroId !== hero.id) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 })
  }

  const updated = await db.combatProfile.update({
    where: { id },
    data: parsed.data,
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 })
  }

  const hero = await db.hero.findFirst({ where: { userId: session.user.id } })
  if (!hero) {
    return NextResponse.json({ error: "No tenés un héroe" }, { status: 404 })
  }

  const profile = await db.combatProfile.findUnique({ where: { id } })
  if (profile?.heroId !== hero.id) {
    return NextResponse.json({ error: "Perfil no encontrado" }, { status: 404 })
  }

  const profileCount = await db.combatProfile.count({ where: { heroId: hero.id } })
  if (profileCount <= 1) {
    return NextResponse.json({ error: "No podés eliminar el único perfil" }, { status: 400 })
  }

  await db.combatProfile.delete({ where: { id } })

  return NextResponse.json({ deleted: true })
}
