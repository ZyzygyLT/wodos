import { NextResponse } from 'next/server'
import { findHeroById, updateHeroAttrs, updateHeroName, deleteHero } from '@/services/hero-admin-service'
import { updateAdminHeroSchema } from '@/lib/validations/hero'
import { requireAdmin } from '@/lib/admin/require-admin'
import { formatZodError } from '@/lib/zod-error'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const hero = await findHeroById(id)
  if (!hero) return NextResponse.json({ error: 'Hero not found' }, { status: 404 })
  return NextResponse.json(hero)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const existing = await findHeroById(id)
  if (!existing) return NextResponse.json({ error: 'Hero not found' }, { status: 404 })

  const body = await request.json()
  const parsed = updateAdminHeroSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: formatZodError(parsed.error).fieldErrors }, { status: 422 })
  }

  let hero = existing
  if (parsed.data.name) hero = await updateHeroName(id, parsed.data.name)
  if (parsed.data.attrs) hero = await updateHeroAttrs(id, parsed.data.attrs)
  return NextResponse.json(hero)
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const existing = await findHeroById(id)
  if (!existing) return NextResponse.json({ error: 'Hero not found' }, { status: 404 })

  await deleteHero(id)
  return new NextResponse(null, { status: 204 })
}
