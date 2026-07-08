import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/require-admin'
import { findAttributeById, updateAttribute } from '@/services/attribute-service'
import AttributeForm from '@/components/attributes/attribute-form'

export default async function EditAttributePage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const auth = await requireAdmin()
  if ('error' in auth) return <div className="p-8 text-red-500">Access denied</div>

  const { id } = await params
  const attr = await findAttributeById(id)
  if (!attr) return <div className="p-8 text-red-500">Attribute not found</div>

  async function handleSubmit(data: { name: string; abbreviation: string; description: string | null; minValue: number; maxValue: number }) {
    'use server'
    await requireAdmin()
    await updateAttribute(id, data)
    redirect('/attributes')
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Attribute</h1>
      <AttributeForm
        initialData={{
          name: attr.name,
          abbreviation: attr.abbreviation,
          description: attr.description,
          minValue: attr.minValue,
          maxValue: attr.maxValue,
        }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
