import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/require-admin'
import { findAllAttributes } from '@/services/attribute-service'
import AttributeList from '@/components/attributes/attribute-list'

export default async function AttributesPage() {
  const auth = await requireAdmin()
  if ('error' in auth) return <div className="p-8 text-red-500">Access denied</div>

  const attributes = await findAllAttributes(true)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Attribute Definitions</h1>
        <Link href="/attributes/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          + New Attribute
        </Link>
      </div>

      {attributes.length === 0 ? (
        <p className="text-gray-500">No attributes defined yet.</p>
      ) : (
        <AttributeList attributes={attributes} />
      )}
    </div>
  )
}
