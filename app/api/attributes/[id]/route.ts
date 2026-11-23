import { NextResponse } from 'next/server'
import { findAttributeById, updateAttribute } from '@/services/attribute-service'
import { updateAttributeSchema } from '@/lib/validations/attribute'
import { requireAdmin } from '@/lib/admin/require-admin'
import { formatZodError } from '@/lib/zod-error'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const attr = await findAttributeById(id)
  if (!attr) return NextResponse.json({ error: 'Attribute not found' }, { status: 404 })
  return NextResponse.json(attr)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const existing = await findAttributeById(id)
  if (!existing) return NextResponse.json({ error: 'Attribute not found' }, { status: 404 })

  const body = await request.json()
  const parsed = updateAttributeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: formatZodError(parsed.error).fieldErrors }, { status: 422 })
  }

  const attr = await updateAttribute(id, parsed.data)
  return NextResponse.json(attr)
}
