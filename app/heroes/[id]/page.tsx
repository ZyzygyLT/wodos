import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/require-admin'
import { findHeroById } from '@/services/hero-admin-service'
import { findAllAttributes } from '@/services/attribute-service'
import HeroAttributes from '@/components/heroes/hero-attributes'

export default async function HeroDetailPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const auth = await requireAdmin()
  if ('error' in auth) return <div className="p-8 text-red-500">Access denied</div>

  const { id } = await params
  const hero = await findHeroById(id)
  if (!hero) return <div className="p-8 text-red-500">Hero not found</div>

  const allAttributes = await findAllAttributes(true)
  const attrsDefinitions = allAttributes.map(a => ({
    ...a,
    isArchived: a.archivedAt !== null,
  }))
  const heroAttrs = hero.attrs as Record<string, number>

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{hero.name}</h1>
          <p className="text-gray-500">
            {hero.race.icon} {hero.race.name} · {hero.class.icon} {hero.class.name} · Lv.{hero.level}
          </p>
        </div>
        <Link href={`/heroes/${id}/edit`} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">
          Edit
        </Link>
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Attributes</h2>
        <HeroAttributes attrs={heroAttrs} definitions={attrsDefinitions} />
      </section>

      <div className="text-xs text-gray-400">
        Created: {new Date(hero.createdAt).toLocaleDateString()} · 
        Updated: {new Date(hero.updatedAt).toLocaleDateString()}
      </div>
    </div>
  )
}
