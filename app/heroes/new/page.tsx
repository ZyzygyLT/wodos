import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/require-admin'
import { findAllAttributes } from '@/services/attribute-service'
import db from '@/lib/db'
import { createAdminHero } from '@/services/hero-admin-service'
import HeroForm from '@/components/heroes/hero-form'

export default async function NewHeroPage() {
  const auth = await requireAdmin()
  if ('error' in auth) return <div className="p-8 text-red-500">Access denied</div>

  const attributes = await findAllAttributes()
  const classes = await db.class.findMany({ orderBy: { name: 'asc' } })
  const races = await db.race.findMany({ orderBy: { name: 'asc' } })

  async function handleSubmit(data: { name: string; classId: number; raceId: number; attrs: Record<string, number> }) {
    'use server'
    const auth2 = await requireAdmin()
    if ('error' in auth2) throw new Error('Unauthorized')
    try {
      await createAdminHero({ userId: auth2.user.id, ...data })
    } catch (e) {
      if (e instanceof Error) return e.message
      throw e
    }
    redirect('/heroes')
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create Hero</h1>
      <HeroForm attributes={attributes} classes={classes} races={races} onSubmit={handleSubmit} />
    </div>
  )
}
