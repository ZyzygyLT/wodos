import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDb } from '../setup'
import { trackHeroEventProgress } from '@/services/event.service'

describe('dungeon event progress idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.weeklyEvent.findMany.mockResolvedValue([{ id: 'event-1', name: 'Dungeon challenge' }])
    mockDb.heroEventParticipation.upsert.mockResolvedValue({ progress: 1, target: 5, completed: false })
  })

  it('does not increment personal event progress twice for the same run', async () => {
    mockDb.dungeonRunRewardGrant.create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: 'P2002' })

    await trackHeroEventProgress('hero-1', 'dungeon', 1, 'run-1')
    await trackHeroEventProgress('hero-1', 'dungeon', 1, 'run-1')

    expect(mockDb.dungeonRunRewardGrant.create).toHaveBeenCalledTimes(2)
    expect(mockDb.dungeonRunRewardGrant.create).toHaveBeenCalledWith({
      data: { runId: 'run-1', heroId: 'hero-1', kind: 'event_progress:event-1:dungeon' },
    })
    expect(mockDb.heroEventParticipation.upsert).toHaveBeenCalledTimes(1)
  })
})
