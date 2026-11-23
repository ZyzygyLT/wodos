import { NextResponse } from 'next/server'
import { findAllAttributes, createAttribute } from '@/services/attribute-service'
import { createAttributeSchema } from '@/lib/validations/attribute'
import { requireAdmin } from '@/lib/admin/require-admin'
import { formatZodError } from '@/lib/zod-error'

export async function GET(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const includeArchived = searchParams.get('includeArchived') === 'true'
  const attributes = await findAllAttributes(includeArchived)
  return NextResponse.json({ attributes })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await request.json()
  const parsed = createAttributeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: formatZodError(parsed.error).fieldErrors }, { status: 422 })
  }

  const attribute = await createAttribute(parsed.data)
  return NextResponse.json(attribute, { status: 201 })
}
