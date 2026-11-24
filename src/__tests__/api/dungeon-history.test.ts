import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { auth } from '@/auth'
import { mockDb } from '../setup'

describe('GET /api/dungeon/history', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(mockDb.user.findUnique as Mock).mockResolvedValue({ currentHeroId: 'hero-member' })
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: 'hero-member' })
  })

  it('includes completed expeditions joined as a group participant and excludes unsettled runs', async () => {
    ;(mockDb.dungeonRun.findMany as Mock).mockResolvedValue([{
      id: 'run-led-by-someone-else',
      status: 'done',
      result: 'victory',
      levelsCleared: 3,
      epGained: 240,
      goldGained: 90,
      createdAt: new Date('2026-11-24T12:00:00.000Z'),
      dungeon: { name: 'Crypt', icon: '🏰' },
    }])

    const { GET } = await import('@/app/api/dungeon/history/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockDb.dungeonRun.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        OR: [
          { heroId: 'hero-member' },
          { participants: { some: { heroId: 'hero-member' } } },
        ],
        status: { in: ['done', 'failed'] },
      },
    }))
    expect(data).toEqual([expect.objectContaining({
      id: 'run-led-by-someone-else',
      dungeonName: 'Crypt',
      result: 'victory',
      epGained: 240,
    })])
  })

  it('returns 401 when unauthenticated', async () => {
    ;(auth as Mock).mockResolvedValue(null)
    const { GET } = await import('@/app/api/dungeon/history/route')
    const response = await GET()
    expect(response.status).toBe(401)
  })
})
