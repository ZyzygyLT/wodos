import { NextResponse } from 'next/server'
import { findAttributeById, archiveAttribute } from '@/services/attribute-service'
import { requireAdmin } from '@/lib/admin/require-admin'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const existing = await findAttributeById(id)
  if (!existing) return NextResponse.json({ error: 'Attribute not found' }, { status: 404 })

  const attr = await archiveAttribute(id)
  return NextResponse.json({ id: attr.id, name: attr.name, abbreviation: attr.abbreviation, archivedAt: attr.archivedAt })
}
