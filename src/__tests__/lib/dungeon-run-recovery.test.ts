import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { mockDb } from '../setup'
import { recoverStaleDungeonRuns } from '@/lib/dungeon-run-recovery'

describe('recoverStaleDungeonRuns', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('finalizes stale runs and releases every historical participant reservation', async () => {
    ;(mockDb.dungeonRun.findMany as Mock).mockResolvedValue([{
      id: 'run-stale',
      heroId: 'hero-leader',
      participants: [{ heroId: 'hero-member' }],
    }])
    ;(mockDb.dungeonRun.updateMany as Mock).mockResolvedValue({ count: 1 })

    await recoverStaleDungeonRuns()

    expect(mockDb.dungeonRun.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        status: 'running',
        OR: [
          { executionStartedAt: { lt: expect.any(Date) } },
          { executionStartedAt: null, startedAt: { lt: expect.any(Date) } },
        ],
      }),
      include: { participants: { select: { heroId: true } } },
    })
    expect(mockDb.dungeonRun.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: 'run-stale',
        status: 'running',
      }),
      data: expect.objectContaining({ status: 'failed', result: 'defeat' }),
    })
    expect(mockDb.hero.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['hero-leader', 'hero-member'] },
        dungeonRegisteredId: 'run-stale',
      },
      data: { dungeonRegisteredId: null },
    })
  })

  it('does not clear reservations if another worker already finalized the run', async () => {
    ;(mockDb.dungeonRun.findMany as Mock).mockResolvedValue([{
      id: 'run-raced',
      heroId: 'hero-one',
      participants: [{ heroId: 'hero-two' }],
    }])
    ;(mockDb.dungeonRun.updateMany as Mock).mockResolvedValue({ count: 0 })

    await recoverStaleDungeonRuns()

    expect(mockDb.hero.updateMany).not.toHaveBeenCalled()
  })
})
