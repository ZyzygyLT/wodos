import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { auth } from '@/auth'
import { getActiveHeroByUserId } from '@/lib/hero-utils'
import { mockDb } from '../setup'

vi.mock('@/lib/hero-utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hero-utils')>('@/lib/hero-utils')
  return { ...actual, getActiveHeroByUserId: vi.fn() }
})

describe('GET /api/dungeon/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(auth as Mock).mockResolvedValue({ user: { id: 'user-1' } })
    ;(getActiveHeroByUserId as Mock).mockResolvedValue({ id: 'hero-1' })
  })

  it('returns idle when the hero has no expedition history', async () => {
    ;(mockDb.dungeonRun.findFirst as Mock).mockResolvedValue(null)
    const { GET } = await import('@/app/api/dungeon/status/route')
    const response = await GET()
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'idle' })
  })

  it('returns the run identifier and next departure for a registered expedition', async () => {
    ;(mockDb.dungeonRun.findFirst as Mock).mockResolvedValue({
      id: 'run-registered',
      status: 'registered',
      dungeon: { id: 4, name: 'Crypt', scheduledTimes: ['23:59'] },
    })
    const { GET } = await import('@/app/api/dungeon/status/route')
    const response = await GET()
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data).toEqual(expect.objectContaining({
      status: 'registered', runId: 'run-registered', dungeon: 'Crypt',
    }))
    expect(typeof data.nextRunAt).toBe('string')
  })

  it('returns the run identifier while the expedition is being resolved', async () => {
    const completesAt = new Date('2026-11-27T01:00:00.000Z')
    ;(mockDb.dungeonRun.findFirst as Mock).mockResolvedValue({
      id: 'run-running',
      status: 'running',
      completesAt,
      dungeon: { id: 4, name: 'Crypt', scheduledTimes: [] },
    })
    const { GET } = await import('@/app/api/dungeon/status/route')
    const response = await GET()
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data).toEqual({
      status: 'running', runId: 'run-running', dungeon: 'Crypt',
      completesAt: completesAt.toISOString(),
    })
  })

  it('returns 401 when unauthenticated', async () => {
    ;(auth as Mock).mockResolvedValue(null)
    const { GET } = await import('@/app/api/dungeon/status/route')
    const response = await GET()
    expect(response.status).toBe(401)
  })
})
