import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/require-admin'
import { findHeroById, updateHeroAttrs, updateHeroName } from '@/services/hero-admin-service'
import { findAllAttributes } from '@/services/attribute-service'
import db from '@/lib/db'
import HeroForm from '@/components/heroes/hero-form'

export default async function EditHeroPage({ params }: Readonly<{ params: Promise<{ id: string }> }>) {
  const auth = await requireAdmin()
  if ('error' in auth) return <div className="p-8 text-red-500">Access denied</div>

  const { id } = await params
  const hero = await findHeroById(id)
  if (!hero) return <div className="p-8 text-red-500">Hero not found</div>

  const attributes = await findAllAttributes()
  const classes = await db.class.findMany({ orderBy: { name: 'asc' } })
  const races = await db.race.findMany({ orderBy: { name: 'asc' } })
  const heroAttrs = hero.attrs as Record<string, number>

  async function handleSubmit(data: { name: string; classId: number; raceId: number; attrs: Record<string, number> }) {
    'use server'
    await requireAdmin()
    try {
      await updateHeroName(id, data.name)
      await updateHeroAttrs(id, data.attrs)
    } catch (e) {
      if (e instanceof Error) return e.message
      throw e
    }
    redirect('/heroes')
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Hero</h1>
      <HeroForm
        attributes={attributes}
        classes={classes}
        races={races}
        initialData={{
          name: hero.name,
          classId: hero.classId,
          raceId: hero.raceId,
          attrs: heroAttrs,
        }}
        onSubmit={handleSubmit}
      />
    </div>
  )
}
