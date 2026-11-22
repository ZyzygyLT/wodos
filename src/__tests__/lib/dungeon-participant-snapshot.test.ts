import { describe, expect, it } from 'vitest'
import type { HeroData } from '@/lib/combat-engine/dungeon-runner'
import {
  restoreDungeonParticipantSnapshots,
  snapshotDungeonParticipant,
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
})
