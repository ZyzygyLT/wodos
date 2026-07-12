'use client'
import { useRouter } from 'next/navigation'
import type { AttributeDefinition } from '@/generated/prisma'

interface AttributeListProps {
  attributes: AttributeDefinition[]
}

export default function AttributeList({ attributes }: Readonly<AttributeListProps>) {
  const router = useRouter()

  const handleArchive = async (id: string) => {
    try { await fetch(`/api/attributes/${id}/archive`, { method: 'POST' }) } catch {}
    router.refresh()
  }

  const handleReactivate = async (id: string) => {
    try { await fetch(`/api/attributes/${id}/reactivate`, { method: 'POST' }) } catch {}
    router.refresh()
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-3 py-2 border">Name</th>
            <th className="text-left px-3 py-2 border">Abbr</th>
            <th className="text-left px-3 py-2 border">Description</th>
            <th className="text-center px-3 py-2 border">Range</th>
            <th className="text-center px-3 py-2 border">Status</th>
            <th className="text-center px-3 py-2 border">Actions</th>
          </tr>
        </thead>
        <tbody>
          {attributes.map(attr => (
            <tr key={attr.id} className={attr.archivedAt ? 'bg-yellow-50 text-gray-500' : ''}>
              <td className="px-3 py-2 border font-medium">{attr.name}</td>
              <td className="px-3 py-2 border">{attr.abbreviation}</td>
              <td className="px-3 py-2 border text-sm">{attr.description}</td>
              <td className="px-3 py-2 border text-center">{attr.minValue}–{attr.maxValue}</td>
              <td className="px-3 py-2 border text-center">
                {attr.archivedAt
                  ? <span className="text-yellow-600 text-xs">archived</span>
                  : <span className="text-green-600 text-xs">active</span>
                }
              </td>
              <td className="px-3 py-2 border text-center">
                <a href={`/attributes/${attr.id}/edit`} className="text-blue-600 hover:underline mr-2 text-sm">Edit</a>
                {attr.archivedAt ? (
                  <button onClick={() => handleReactivate(attr.id)} className="text-green-600 hover:underline text-sm">Reactivate</button>
                ) : (
                  <button onClick={() => handleArchive(attr.id)} className="text-yellow-600 hover:underline text-sm">Archive</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
