import type { AttributeDefinition } from '@/generated/prisma'

interface HeroAttributesProps {
  attrs: Record<string, number>
  definitions: (AttributeDefinition & { isArchived?: boolean })[]
}

export default function HeroAttributes({ attrs, definitions }: Readonly<HeroAttributesProps>) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className="text-left px-3 py-2 border">Attribute</th>
            <th className="text-left px-3 py-2 border">Abbr</th>
            <th className="text-right px-3 py-2 border">Value</th>
            <th className="text-center px-3 py-2 border">Status</th>
          </tr>
        </thead>
        <tbody>
          {definitions.map(def => {
            const value = attrs[def.abbreviation]
            if (value === undefined) return null
            return (
              <tr key={def.id} className={def.isArchived ? 'bg-yellow-50' : ''}>
                <td className="px-3 py-2 border">{def.name}</td>
                <td className="px-3 py-2 border text-gray-500">{def.abbreviation}</td>
                <td className="px-3 py-2 border text-right font-mono">{value}</td>
                <td className="px-3 py-2 border text-center">
                  {def.isArchived ? <span className="text-yellow-600 text-xs">archived</span> : <span className="text-green-600 text-xs">active</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
