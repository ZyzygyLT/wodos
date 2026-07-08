import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockDb = {
  heroQuest: {
    findMany: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  hero: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  quest: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}

vi.mock('@/lib/db', () => ({ default: mockDb }))
vi.unmock('@/lib/quests/progress')

const { updateQuestProgress } = await import('@/lib/quests/progress')

function getUpdateData(): Record<string, any> {
  return mockDb.heroQuest.update.mock.calls[0][0]?.data ?? {}
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('updateQuestProgress', () => {
  const baseQuest = {
    id: 'q-1',
    slug: 'test-quest',
    name: 'Test Quest',
    type: 'main',
    chainNext: null,
    objectives: [
      { id: 'o1', type: 'dungeon_complete', dungeonSlug: 'cueva-aranyas', required: 1 },
      { id: 'o2', type: 'total_kills', required: 50 },
    ],
    rewards: { ep: 100, gold: 50, fame: 10 },
  }

  const baseHq = (overrides?: { progress?: Record<string, number>; objectives?: any[] }) => ({
    id: 'hq-1',
    heroId: 'hero-1',
    questId: 'q-1',
    status: 'active',
    progress: overrides?.progress ?? { o1: 0, o2: 0 },
    quest: { ...baseQuest, objectives: overrides?.objectives ?? baseQuest.objectives } as any,
  })

  it('advances dungeon_complete progress when slug matches', async () => {
    mockDb.heroQuest.findMany.mockResolvedValue([baseHq()])
    await updateQuestProgress('hero-1', { type: 'dungeon_complete', dungeonSlug: 'cueva-aranyas' })

    expect(mockDb.heroQuest.update).toHaveBeenCalled()
    const data = getUpdateData()
    expect(data.progress.o1).toBe(1)
    expect(data.progress.o2).toBe(0)
  })

  it('does NOT advance progress when slug does not match', async () => {
    mockDb.heroQuest.findMany.mockResolvedValue([baseHq()])
    await updateQuestProgress('hero-1', { type: 'dungeon_complete', dungeonSlug: 'ruinas-abandonadas' })

    expect(mockDb.heroQuest.update).not.toHaveBeenCalled()
  })

  it('advances kills progress with correct increment', async () => {
    mockDb.heroQuest.findMany.mockResolvedValue([baseHq()])
    await updateQuestProgress('hero-1', { type: 'total_kills', kills: 10 })

    expect(mockDb.heroQuest.update).toHaveBeenCalled()
    const data = getUpdateData()
    expect(data.progress.o2).toBe(10)
  })

  it('completes quest via transaction when all objectives are done', async () => {
    mockDb.heroQuest.findMany.mockResolvedValue([baseHq({
      objectives: [{ id: 'o1', type: 'dungeon_complete', dungeonSlug: 'cueva-aranyas', required: 1 }],
    })])
    mockDb.hero.findFirst.mockResolvedValue({ userId: 'user-1' })
    mockDb.$transaction.mockImplementation(async (promises: any) => Promise.all(promises))
    mockDb.heroQuest.update.mockImplementation(async (args: any) => args)
    mockDb.hero.update.mockImplementation(async (args: any) => args)

    await updateQuestProgress('hero-1', { type: 'dungeon_complete', dungeonSlug: 'cueva-aranyas' })

    expect(mockDb.$transaction).toHaveBeenCalled()
    expect(mockDb.heroQuest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'hq-1' },
        data: expect.objectContaining({ status: 'completed' }),
      })
    )
  })

  it('clamps progress to required value', async () => {
    mockDb.heroQuest.findMany.mockResolvedValue([baseHq({
      progress: { o1: 0, o2: 45 },
      objectives: [
        { id: 'o1', type: 'dungeon_complete', dungeonSlug: 'cueva-aranyas', required: 1 },
        { id: 'o2', type: 'total_kills', required: 50 },
      ],
    })])
    await updateQuestProgress('hero-1', { type: 'total_kills', kills: 10 })

    const data = getUpdateData()
    expect(data.progress.o2).toBe(50)
  })

  it('ignores non-matching event types', async () => {
    mockDb.heroQuest.findMany.mockResolvedValue([baseHq()])
    await updateQuestProgress('hero-1', { type: 'level', value: 5 })

    expect(mockDb.heroQuest.update).not.toHaveBeenCalled()
  })
})
