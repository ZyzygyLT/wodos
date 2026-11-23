import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/require-admin'
import { createAttribute } from '@/services/attribute-service'
import AttributeForm from '@/components/attributes/attribute-form'

export default async function NewAttributePage() {
  const auth = await requireAdmin()
  if ('error' in auth) return <div className="p-8 text-red-500">Access denied</div>

  async function handleSubmit(data: { name: string; abbreviation: string; description: string | null; minValue: number; maxValue: number }) {
    'use server'
    await requireAdmin()
    await createAttribute(data)
    redirect('/attributes')
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create Attribute</h1>
      <AttributeForm onSubmit={handleSubmit} />
    </div>
  )
}
