import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { auth } from '@/auth'
import { mockDb } from '../setup'

const USER_ID = 'user-report'
const RUN_ID = 'run-history'

function mockSession() {
  ;(auth as Mock).mockResolvedValue({ user: { id: USER_ID } })
}

function mockRun() {
  ;(mockDb.dungeonRun.findUnique as Mock).mockResolvedValue({
    id: RUN_ID,
    heroId: 'hero-leader',
    groupId: 'group-1',
    status: 'done',
    result: 'victory',
    completesAt: new Date(),
    levelsCleared: 2,
    epGained: 100,
    goldGained: 50,
    report: [],
    levelReports: [],
    loot: [],
    dungeon: { id: 1, name: 'Crypt' },
    participants: [
      { heroId: 'hero-leader', snapshot: { name: 'Leader' } },
      { heroId: 'hero-member', snapshot: { name: 'Former member' } },
    ],
  })
}

describe('GET /api/dungeon/report/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession()
    ;(mockDb.item.findMany as Mock).mockResolvedValue([])
  })

  it('authorizes a hero who participated even after leaving the group', async () => {
    ;(mockDb.hero.findMany as Mock).mockResolvedValue([{ id: 'hero-member', name: 'Former member' }])
    mockRun()

    const { GET } = await import('@/app/api/dungeon/report/[id]/route')
    const response = await GET(new Request('http://localhost/api/dungeon/report/run-history'), {
      params: Promise.resolve({ id: RUN_ID }),
    })
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.participants).toEqual([
      { heroId: 'hero-leader', name: 'Leader' },
      { heroId: 'hero-member', name: 'Former member' },
    ])
    expect(mockDb.clanGroup.findUnique).not.toHaveBeenCalled()
  })

  it('does not grant report access to a player who joined the group later', async () => {
    ;(mockDb.hero.findMany as Mock).mockResolvedValue([{ id: 'new-member', name: 'New member' }])
    mockRun()

    const { GET } = await import('@/app/api/dungeon/report/[id]/route')
    const response = await GET(new Request('http://localhost/api/dungeon/report/run-history'), {
      params: Promise.resolve({ id: RUN_ID }),
    })

    expect(response.status).toBe(403)
    expect(mockDb.clanGroup.findUnique).not.toHaveBeenCalled()
  })
})
