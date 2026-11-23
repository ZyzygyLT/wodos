import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getActiveHeroByUserId } from '@/lib/hero-utils'
import { mockDb } from '../setup'

vi.mock('@/lib/hero-utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hero-utils')>('@/lib/hero-utils')
  return { ...actual, getActiveHeroByUserId: vi.fn() }
})

describe('POST /api/hero/consumables', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(getActiveHeroByUserId as Mock).mockResolvedValue({ id: 'hero-1' })
    ;(mockDb.hero.findUnique as Mock).mockResolvedValue({
      id: 'hero-1',
      hpCurrent: 20,
      hpMax: 100,
      mpCurrent: 10,
      mpMax: 50,
    })
  })

  it('prevents consuming items while an immutable expedition snapshot is active', async () => {
    ;(mockDb.dungeonRun.findFirst as Mock).mockResolvedValue({ id: 'run-1' })

    const { POST } = await import('@/app/api/hero/consumables/route')
    const response = await POST(new NextRequest('http://localhost/api/hero/consumables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroItemId: 'potion-1' }),
    }))
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('expedición activa')
    expect(mockDb.heroItem.findFirst).not.toHaveBeenCalled()
    expect(mockDb.hero.update).not.toHaveBeenCalled()
  })
})
