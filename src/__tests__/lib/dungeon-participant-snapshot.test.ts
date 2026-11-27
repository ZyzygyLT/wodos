import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Mock } from 'vitest'
import { mockDb } from '../setup'
import type { HeroData } from '@/lib/combat-engine/dungeon-runner'
import {
  restoreDungeonParticipantSnapshots,
  snapshotDungeonParticipant,
  hasHeroRunDungeonToday,
  hasGroupRunDungeonToday,
  reconcileDungeonParticipantConsumables,
} from '@/lib/dungeon-helpers'

function makeParticipant(id: string): HeroData {
  return {
    id,
    name: `Hero ${id}`,
    level: 4,
    attrs: { strength: 12 },
    hpMax: 100,
    mpMax: 60,
    hpCurrent: 73,
    mpCurrent: 41,
    gold: 25,
    profileId: `profile-${id}`,
    combatProfile: {
      position: 'front',
      prelimRules: [],
      roundRules: [],
      defenseSkills: {},
    },
    skills: [{ skillId: 1, multiplier: 1.5, manaCost: 4, rank: 2 }],
    equipStats: { atk: 8 },
    consumables: [{ heroItemId: `item-${id}`, itemId: 9, healHp: 20 }],
  }
}

describe('dungeon participant snapshots', () => {
  it('creates an isolated JSON snapshot of the participant build', () => {
    const participant = makeParticipant('hero-1')
    const snapshot = snapshotDungeonParticipant(participant)

    participant.attrs.strength = 99
    participant.skills[0].rank = 10
    participant.consumables?.pop()

    expect(snapshot.attrs.strength).toBe(12)
    expect(snapshot.skills[0].rank).toBe(2)
    expect(snapshot.consumables).toHaveLength(1)
    expect(snapshot.hpCurrent).toBe(73)
    expect(snapshot.mpCurrent).toBe(41)
  })

  it('restores participants in the stored order', () => {
    const first = snapshotDungeonParticipant(makeParticipant('hero-1'))
    const second = snapshotDungeonParticipant(makeParticipant('hero-2'))

    const restored = restoreDungeonParticipantSnapshots([
      { snapshot: second },
      { snapshot: first },
    ])

    expect(restored?.map(participant => participant.id)).toEqual(['hero-2', 'hero-1'])
  })

  it('rejects empty, incomplete, and duplicate participant snapshots', () => {
    expect(restoreDungeonParticipantSnapshots([])).toBeNull()
    expect(restoreDungeonParticipantSnapshots([{ snapshot: { id: 'hero-1' } }])).toBeNull()

    const snapshot = snapshotDungeonParticipant(makeParticipant('hero-1'))
    expect(restoreDungeonParticipantSnapshots([
      { snapshot },
      { snapshot },
    ])).toBeNull()

    const incomplete = { ...snapshot, hpCurrent: undefined }
    expect(restoreDungeonParticipantSnapshots([{ snapshot: incomplete }])).toBeNull()
  })
  it('removes snapshot consumables that no longer exist before scheduled execution', async () => {
    const first = makeParticipant('hero-1')
    const second = makeParticipant('hero-2')
    ;(mockDb.heroItem.findMany as Mock).mockResolvedValue([
      { id: 'item-hero-2', heroId: 'hero-2' },
    ])

    await reconcileDungeonParticipantConsumables([first, second])

    expect(mockDb.heroItem.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['item-hero-1', 'item-hero-2'] },
        heroId: { in: ['hero-1', 'hero-2'] },
      },
      select: { id: true, heroId: true },
    })
    expect(first.consumables).toEqual([])
    expect(second.consumables).toEqual([
      { heroItemId: 'item-hero-2', itemId: 9, healHp: 20 },
    ])
  })

  describe('daily expedition history', () => {
    beforeEach(() => {
      vi.clearAllMocks()
      ;(mockDb.dungeonRun.count as Mock).mockResolvedValue(0)
    })

    it('counts a run where the hero was a participant, not only its leader', async () => {
      await hasHeroRunDungeonToday('hero-member')
      expect(mockDb.dungeonRun.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            { heroId: 'hero-member' },
            { participants: { some: { heroId: 'hero-member' } } },
          ],
          status: 'done',
        }),
      })
    })

    it('counts group members through historical participant rows', async () => {
      await hasGroupRunDungeonToday(['hero-one', 'hero-two'])
      expect(mockDb.dungeonRun.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          OR: [
            { heroId: { in: ['hero-one', 'hero-two'] } },
            { participants: { some: { heroId: { in: ['hero-one', 'hero-two'] } } } },
          ],
          status: 'done',
        }),
      })
    })
  })

})
