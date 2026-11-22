import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { auth } from '@/auth'
import { getActiveHeroByUserId } from '@/lib/hero-utils'
import { mockDb } from '../setup'

vi.mock('@/lib/hero-utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hero-utils')>('@/lib/hero-utils')
  return { ...actual, getActiveHeroByUserId: vi.fn() }
})

describe('POST /api/dungeon/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(getActiveHeroByUserId as Mock).mockResolvedValue({
      id: 'hero-1',
      dungeonRegisteredId: 'run-1',
    })
    ;(mockDb.dungeonRun.findFirst as Mock).mockResolvedValue({
      id: 'run-1',
      heroId: 'hero-1',
      participants: [{ heroId: 'hero-1' }, { heroId: 'hero-2' }],
    })
  })

  it('returns a conflict if the expedition started before cancellation', async () => {
    ;(mockDb.dungeonRun.updateMany as Mock).mockResolvedValue({ count: 0 })

    const { POST } = await import('@/app/api/dungeon/cancel/route')
    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(409)
    expect(data.error).toContain('ya comenzó')
    expect(mockDb.hero.updateMany).not.toHaveBeenCalled()
  })

  it('clears registration pointers only after a pending run is cancelled', async () => {
    ;(mockDb.dungeonRun.updateMany as Mock).mockResolvedValue({ count: 1 })

    const { POST } = await import('@/app/api/dungeon/cancel/route')
    const response = await POST()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.cancelled).toBe(true)
    expect(mockDb.hero.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['hero-1', 'hero-2'] }, dungeonRegisteredId: 'run-1' },
      data: { dungeonRegisteredId: null },
    })
  })
})
