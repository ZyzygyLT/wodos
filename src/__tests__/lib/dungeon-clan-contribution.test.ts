import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockDb } from '../setup'
import type { HeroData, RunResult } from '@/lib/combat-engine/dungeon-runner'

vi.mock('@/lib/level-up', () => ({
  checkLevelUp: vi.fn(() => Promise.resolve({ leveledUp: false })),
}))

vi.mock('@/lib/craft/material-drops', () => ({
  grantMaterialDrops: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/services/event.service', () => ({
  trackHeroEventProgress: vi.fn(() => Promise.resolve()),
}))

vi.mock('@/services/faction.service', () => ({
  adjustRep: vi.fn(() => Promise.resolve()),
}))

import { processPostRun } from '@/services/dungeon-execution.service'

describe('dungeon post-run clan event contribution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDb.weeklyEvent.findFirst.mockResolvedValue({ id: 'event-1' })
    mockDb.clanEventParticipation.upsert.mockResolvedValue({})
  })

  it('contributes group kills once per expedition, not once per participant', async () => {
    const result = {
      victory: true,
      epGained: 20,
      goldGained: 10,
      fameGained: 2,
      levelsCleared: 1,
      loot: [],
      log: [{ type: 'death', actorId: 'enemy-1' }],
      heroesFinalState: [
        { id: 'hero-1', hp: 10, mp: 5 },
        { id: 'hero-2', hp: 8, mp: 4 },
      ],
    }

    await processPostRun({
      result: result as unknown as RunResult,
      heroesData: [{ id: 'hero-1' }, { id: 'hero-2' }] as unknown as HeroData[],
      totalHeroes: 2,
      dungeon: { id: 1, name: 'Test Dungeon', slug: 'test-dungeon' },
      runId: 'run-1',
      clanMemberRec: { clanId: 'clan-1', clan: { upgrades: [] } },
    })

    expect(mockDb.clanEventParticipation.upsert).toHaveBeenCalledTimes(1)
    expect(mockDb.clanEventParticipation.upsert).toHaveBeenCalledWith({
      where: { clanId_eventId: { clanId: 'clan-1', eventId: 'event-1' } },
      update: { score: { increment: 1 } },
      create: { clanId: 'clan-1', eventId: 'event-1', score: 1 },
    })
  })

  it('does not query or update clan events without a clan', async () => {
    await processPostRun({
      result: {
        victory: true,
        epGained: 0,
        goldGained: 0,
        fameGained: 0,
        levelsCleared: 0,
        loot: [],
        log: [{ type: 'death', actorId: 'enemy-1' }],
        heroesFinalState: [{ id: 'hero-1', hp: 10, mp: 5 }],
      } as unknown as RunResult,
      heroesData: [{ id: 'hero-1' }] as unknown as HeroData[],
      totalHeroes: 1,
      dungeon: { id: 1, name: 'Test Dungeon', slug: 'test-dungeon' },
      runId: 'run-2',
    })

    expect(mockDb.weeklyEvent.findFirst).not.toHaveBeenCalled()
    expect(mockDb.clanEventParticipation.upsert).not.toHaveBeenCalled()
  })
})
