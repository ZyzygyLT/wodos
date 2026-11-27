import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { auth } from '@/auth'
import { mockDb } from '../setup'

describe('GET /api/dungeons', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(mockDb.user.findUnique as Mock).mockResolvedValue({ currentHeroId: 'hero-participant' })
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({
      id: 'hero-participant',
      level: 5,
      dungeonRegisteredId: null,
      combatProfiles: [],
    })
    ;(mockDb.clanMember.findUnique as Mock).mockResolvedValue(null)
    ;(mockDb.dungeon.findMany as Mock).mockResolvedValue([{
      id: 7,
      name: 'Crypt',
      slug: 'crypt',
      icon: '🏰',
      levelReq: 1,
      recommendedLevel: 5,
      difficultyLabel: 'Normal',
      difficulty: 2,
      isInstant: false,
      scheduledTimes: ['20:00'],
    }])
    ;(mockDb.dungeonRun.findFirst as Mock).mockResolvedValue(null)
  })

  it('marks a dungeon as registered when the hero participates in another hero’s active group run', async () => {
    ;(mockDb.dungeonRun.findFirst as Mock).mockResolvedValue({
      id: 'run-led-by-another-hero',
      heroId: 'hero-leader',
      dungeonId: 7,
      status: 'registered',
      dungeon: { name: 'Crypt' },
    })

    const { GET } = await import('@/app/api/dungeons/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(mockDb.dungeonRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        participants: { some: { heroId: 'hero-participant' } },
        status: { in: ['registered', 'running'] },
      },
    }))
    expect(data[0].scheduledTimes).toEqual(['02:00', '06:00', '10:00', '14:00', '18:00', '22:00'])
    expect(data[0]).toEqual(expect.objectContaining({
      isRegistered: true,
      registeredRunId: 'run-led-by-another-hero',
      activeRunDungeonId: 7,
      activeRunDungeonName: 'Crypt',
    }))
  })

  it('exposes an active run on another dungeon to prevent overlapping entry', async () => {
    ;(mockDb.dungeonRun.findFirst as Mock).mockResolvedValue({
      id: 'run-on-another-dungeon',
      heroId: 'hero-leader',
      dungeonId: 9,
      status: 'running',
      dungeon: { name: 'Ashen Depths' },
    })

    const { GET } = await import('@/app/api/dungeons/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data[0]).toEqual(expect.objectContaining({
      isRegistered: false,
      activeRunDungeonId: 9,
      activeRunDungeonName: 'Ashen Depths',
    }))
  })

  it('does not mark completed participation as registered', async () => {
    ;(mockDb.dungeonRun.findFirst as Mock).mockResolvedValue(null)

    const { GET } = await import('@/app/api/dungeons/route')
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data[0].scheduledTimes).toEqual(['02:00', '06:00', '10:00', '14:00', '18:00', '22:00'])
    expect(data[0].isRegistered).toBe(false)
    expect(data[0].registeredRunId).toBeNull()
  })
})
