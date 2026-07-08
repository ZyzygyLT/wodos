import Link from 'next/link'
import { requireAdmin } from '@/lib/admin/require-admin'
import { findAllHeroes } from '@/services/hero-admin-service'
import HeroCard from '@/components/heroes/hero-card'

export default async function HeroesPage() {
  const auth = await requireAdmin()
  if ('error' in auth) return <div className="p-8 text-red-500">Access denied</div>

  const heroes = await findAllHeroes()

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Heroes</h1>
        <Link href="/heroes/new" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          + New Hero
        </Link>
      </div>

      {heroes.length === 0 ? (
        <p className="text-gray-500">No heroes created yet.</p>
      ) : (
        <div className="space-y-3">
          {heroes.map(hero => (
            <HeroCard
              key={hero.id}
              id={hero.id}
              name={hero.name}
              className={hero.class.name}
              raceName={hero.race.name}
              level={hero.level}
              classIcon={hero.class.icon}
              raceIcon={hero.race.icon}
            />
          ))}
        </div>
      )}
    </div>
  )
}
