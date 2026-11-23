import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdate = vi.fn()
const mockFindFirst = vi.fn()

vi.mock('@/lib/db', () => ({
  default: {
    $transaction: (callback: (tx: { hero: { findFirst: typeof mockFindFirst; update: typeof mockUpdate } }) => unknown) =>
      callback({
        hero: {
          findFirst: mockFindFirst,
          update: mockUpdate,
        },
      }),
    hero: {
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
  },
}))

const { checkLevelUp, totalEpForLevel, levelFromEp, epForLevel } = await import('@/lib/level-up')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('epForLevel', () => {
  it('returns 200 for level 1', () => {
    expect(epForLevel(1)).toBe(200)
  })

  it('returns 320 for level 2', () => {
    expect(epForLevel(2)).toBe(320)
  })

  it('scales exponentially', () => {
    expect(epForLevel(10)).toBeGreaterThan(5000)
  })
})

describe('totalEpForLevel', () => {
  it('returns 0 for level 1', () => {
    expect(totalEpForLevel(1)).toBe(0)
  })

  it('returns 200 for level 2', () => {
    expect(totalEpForLevel(2)).toBe(200)
  })

  it('returns cumulative total', () => {
    expect(totalEpForLevel(3)).toBe(200 + 320)
  })
})

describe('levelFromEp', () => {
  it('returns 1 for 0 EP', () => {
    expect(levelFromEp(0)).toBe(1)
  })

  it('returns 1 for 199 EP', () => {
    expect(levelFromEp(199)).toBe(1)
  })

  it('returns 2 for 200 EP', () => {
    expect(levelFromEp(200)).toBe(2)
  })
})

describe('checkLevelUp', () => {
  const baseHero = {
    id: 'hero-1',
    level: 1,
    epTotal: 0,
    hpMax: 100,
    mpMax: 50,
    freeAttrPoints: 0,
    attrs: { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 },
  }

  it('returns leveledUp=false when not enough EP', async () => {
    mockFindFirst.mockResolvedValue(baseHero)
    const result = await checkLevelUp('hero-1')
    expect(result.leveledUp).toBe(false)
    expect(result.levelsGained).toBe(0)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('levels up when EP crosses threshold', async () => {
    mockFindFirst.mockResolvedValue({ ...baseHero, epTotal: 200 })
    mockUpdate.mockResolvedValue({})

    const result = await checkLevelUp('hero-1')

    expect(result.leveledUp).toBe(true)
    expect(result.levelsGained).toBe(1)
    expect(result.newLevel).toBe(2)
  })

  it('awards 5 freeAttrPoints per level gained', async () => {
    mockFindFirst.mockResolvedValue({ ...baseHero, epTotal: 200 })
    mockUpdate.mockResolvedValue({})

    await checkLevelUp('hero-1')

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hero-1' },
        data: expect.objectContaining({
          freeAttrPoints: { increment: 5 },
        }),
      })
    )
  })

  it('awards multiple levels for large EP', async () => {
    mockFindFirst.mockResolvedValue({ ...baseHero, epTotal: 2000 })
    mockUpdate.mockResolvedValue({})

    const result = await checkLevelUp('hero-1')

    expect(result.levelsGained).toBeGreaterThan(1)
    expect(result.pointsAwarded).toBe(result.levelsGained * 5)
  })

  it('updates hpCurrent and mpCurrent to max after level up', async () => {
    mockFindFirst.mockResolvedValue({ ...baseHero, epTotal: 200 })
    mockUpdate.mockResolvedValue({})

    await checkLevelUp('hero-1')

    const data = mockUpdate.mock.calls[0][0].data
    expect(data.hpCurrent).toBe(data.hpMax)
    expect(data.mpCurrent).toBe(data.mpMax)
  })

  it('recalculates hpMax based on new level', async () => {
    mockFindFirst.mockResolvedValue({ ...baseHero, epTotal: 200 })
    mockUpdate.mockResolvedValue({})

    await checkLevelUp('hero-1')

    const data = mockUpdate.mock.calls[0][0].data
    expect(data.hpMax).toBe(10 * 10 + 2 * 5) // co*10 + level*5
  })

  it('throws when hero not found', async () => {
    mockFindFirst.mockResolvedValue(null)
    await expect(checkLevelUp('nonexistent')).rejects.toThrow('Hero not found')
  })
})
