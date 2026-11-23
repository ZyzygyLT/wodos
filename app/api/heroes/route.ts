import { NextResponse } from 'next/server'
import { findAllHeroes, createAdminHero } from '@/services/hero-admin-service'
import { createAdminHeroSchema } from '@/lib/validations/hero'
import { requireAdmin } from '@/lib/admin/require-admin'
import { formatZodError } from '@/lib/zod-error'

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const heroes = await findAllHeroes()
  return NextResponse.json({ heroes })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const parsed = createAdminHeroSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: formatZodError(parsed.error).fieldErrors }, { status: 422 })
  }

  const hero = await createAdminHero({
    userId: auth.user.id,
    ...parsed.data,
  })
  return NextResponse.json(hero, { status: 201 })
}
