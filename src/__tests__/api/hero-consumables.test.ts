import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { getActiveHeroByUserId } from '@/lib/hero-utils'
import { buildHeroData } from '@/lib/dungeon-helpers'
import { mockDb } from '../setup'

vi.mock('@/lib/hero-utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hero-utils')>('@/lib/hero-utils')
  return { ...actual, getActiveHeroByUserId: vi.fn() }
})

vi.mock('@/lib/dungeon-helpers', async () => {
  const actual = await vi.importActual<typeof import('@/lib/dungeon-helpers')>('@/lib/dungeon-helpers')
  return { ...actual, buildHeroData: vi.fn() }
})

describe('POST /api/hero/consumables', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(getActiveHeroByUserId as Mock).mockResolvedValue({ id: 'hero-1' })
    ;(mockDb.hero.findUnique as Mock).mockResolvedValue({
      id: 'hero-1',
      hpCurrent: 90,
      hpMax: 100,
      mpCurrent: 45,
      mpMax: 50,
      level: 1,
      attrs: { co: 10, wi: 10, in: 10 },
      skills: [],
      items: [],
    })
    ;(buildHeroData as Mock).mockResolvedValue({
      equipStats: { hp: 50, mp: 25 },
      skills: [],
    })
    ;(mockDb.dungeonRun.findFirst as Mock).mockResolvedValue(null)
    ;(mockDb.heroItem.findFirst as Mock).mockResolvedValue({
      id: 'potion-1',
      item: { stats: { healHp: 30, healMp: 20 } },
    })
    ;(mockDb.heroItem.deleteMany as Mock).mockResolvedValue({ count: 1 })
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

  it('heals up to effective HP and MP maxima including equipment bonuses', async () => {
    const { POST } = await import('@/app/api/hero/consumables/route')
    const response = await POST(new NextRequest('http://localhost/api/hero/consumables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ heroItemId: 'potion-1' }),
    }))
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.hpCurrent).toBe(120)
    expect(data.mpCurrent).toBe(65)
    expect(data.effects).toEqual({ healHp: 30, healMp: 20 })
    expect(mockDb.hero.update).toHaveBeenCalledWith({
      where: { id: 'hero-1' },
      data: { hpCurrent: 120, mpCurrent: 65 },
    })
  })
})
