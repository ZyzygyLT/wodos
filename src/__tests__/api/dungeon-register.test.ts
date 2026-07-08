import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

vi.mock('@/services/dungeon-registration.service', () => ({
  processInstantDungeon: vi.fn(),
  registerScheduledDungeon: vi.fn(),
}))

vi.mock('@/lib/dungeon-helpers', () => ({
  buildHeroData: vi.fn(),
  enrichDungeonLevels: vi.fn(),
  loadGroupParticipants: vi.fn(),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ ok: true, remaining: 20, resetAt: new Date() })),
  ipKey: vi.fn(() => 'test-ip'),
}))

import { mockDb } from '../setup'
import { auth } from '@/auth'
const FAKE_USER_ID = 'user-1'
const FAKE_HERO_ID = 'hero-1'

function mockSession() {
  ;(auth as Mock).mockResolvedValue({ user: { id: FAKE_USER_ID } })
}

function mockNoSession() {
  ;(auth as Mock).mockResolvedValue(null)
}

function jsonResponse(res: Response): Promise<any> {
  return res.json()
}

describe('POST /api/dungeon/register', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns 401 without auth', async () => {
    mockNoSession()
    const { POST } = await import('@/app/api/dungeon/register/route')
    const req = new Request('http://localhost/api/dungeon/register', {
      method: 'POST', body: JSON.stringify({ dungeonId: 1 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid dungeonId', async () => {
    mockSession()
    const { POST } = await import('@/app/api/dungeon/register/route')
    const req = new Request('http://localhost/api/dungeon/register', {
      method: 'POST', body: JSON.stringify({ dungeonId: -1 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 404 if hero not found', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue(null)
    const { POST } = await import('@/app/api/dungeon/register/route')
    const req = new Request('http://localhost/api/dungeon/register', {
      method: 'POST', body: JSON.stringify({ dungeonId: 1 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(404)
  })

  it('returns 404 if dungeon not found', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID })
    ;(mockDb.dungeon.findUnique as Mock).mockResolvedValue(null)
    const { POST } = await import('@/app/api/dungeon/register/route')
    const req = new Request('http://localhost/api/dungeon/register', {
      method: 'POST', body: JSON.stringify({ dungeonId: 999 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(404)
  })

  it('processes an instant dungeon successfully', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, name: 'TestHero' })
    ;(mockDb.dungeon.findUnique as Mock).mockResolvedValue({ id: 1, name: 'Test Dungeon', levelReq: 1, isInstant: true })

    const { processInstantDungeon } = await import('@/services/dungeon-registration.service')
    ;(processInstantDungeon as Mock).mockResolvedValue({
      ok: true,
      data: {
        runId: 'run-1', isGroup: false, totalHeroes: 1,
        victory: true, rounds: 3,
        epGained: 200, goldGained: 100, fameGained: 10,
        heroFinalHp: 80, heroesFinalState: [{ id: FAKE_HERO_ID, hp: 80, mp: 50 }],
        loot: [{ itemId: 1, qty: 1, name: 'Iron Sword' }],
        log: ['Hero attacks Slime → 25 damage', 'Victory'],
      },
    })

    const { POST } = await import('@/app/api/dungeon/register/route')
    const req = new Request('http://localhost/api/dungeon/register', {
      method: 'POST', body: JSON.stringify({ dungeonId: 1 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(200)
    const data = await jsonResponse(res)
    expect(data.instant).toBe(true)
    expect(data.victory).toBe(true)
    expect(data.epGained).toBe(200)
  })

  it('processes a scheduled dungeon registration', async () => {
    mockSession()
    ;(mockDb.hero.findFirst as Mock).mockResolvedValue({ id: FAKE_HERO_ID, name: 'TestHero' })
    ;(mockDb.dungeon.findUnique as Mock).mockResolvedValue({ id: 2, name: 'Scheduled Dungeon', levelReq: 1, isInstant: false })

    const { registerScheduledDungeon } = await import('@/services/dungeon-registration.service')
    ;(registerScheduledDungeon as Mock).mockResolvedValue({
      ok: true,
      data: { id: 'run-2', dungeon: 'Scheduled Dungeon', status: 'registered' },
    })

    const { POST } = await import('@/app/api/dungeon/register/route')
    const req = new Request('http://localhost/api/dungeon/register', {
      method: 'POST', body: JSON.stringify({ dungeonId: 2 }),
    })
    const res = await POST(req as any)
    expect(res.status).toBe(201)
    const data = await jsonResponse(res)
    expect(data.status).toBe('registered')
    expect(data.dungeon).toBe('Scheduled Dungeon')
  })
})
