import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'

beforeEach(() => {
  vi.clearAllMocks()
})

const makeFakeHero = (id: string, name: string, elo: number) => ({
  id,
  name,
  eloRating: elo,
  level: 5,
  gold: 100,
  hpMax: 125,
  hpCurrent: 125,
  mpMax: 120,
  mpCurrent: 120,
  attrs: { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 },
  class: { icon: '⚔️' },
  combatProfiles: [{ id: 'cp-1', position: 'front', initiativeSkill: 'organization', dungeonLevel: null, prelimRules: [], roundRules: [{ priority: 1, condition: { type: 'always' }, action: { skillId: 1, targetPos: 'front', targetType: 'weakest' } }], defenseSkills: {} }],
  skills: [{ rank: 1, skill: { id: 1, name: 'Golpe', multiplier: 1, manaCost: 5, effect: 'attack', formula: { attrCoeffs: { st: 2, dx: 1 }, skillRankCoeff: 1.5, diceSides: 6, diceCount: 1, flatBonus: 5 }, tags: [] } }],
  items: [],
})

describe('runArenaDuel', () => {
  it('throws error if hero not found', async () => {
    const db = (await import('@/lib/db')).default
    ;(db.hero.findFirst as Mock).mockResolvedValue(null)

    const { runArenaDuel } = await import('@/lib/combat-engine/arena-runner')
    await expect(runArenaDuel('fake-id', 'fake-id-2')).rejects.toThrow('Héroe no encontrado')
  })

  it('returns duel result with ELO change', async () => {
    const { runArenaDuel } = await import('@/lib/combat-engine/arena-runner')
    const db = (await import('@/lib/db')).default
    ;(db.hero.findFirst as Mock).mockResolvedValueOnce(makeFakeHero('h1', 'Hero1', 1200))
    ;(db.hero.findFirst as Mock).mockResolvedValueOnce(makeFakeHero('h2', 'Hero2', 1200))
    ;(db.$transaction as Mock).mockResolvedValue([])

    const result = await runArenaDuel('h1', 'h2')
    expect(result).toHaveProperty('won')
    expect(result).toHaveProperty('eloChange')
    expect(typeof result.eloChange).toBe('number')
    expect(result).toHaveProperty('winner')
    expect(result).toHaveProperty('loser')
  })

  it('higher ELO hero gets smaller gain on win', async () => {
    const { runArenaDuel } = await import('@/lib/combat-engine/arena-runner')
    const db = (await import('@/lib/db')).default
    ;(db.hero.findFirst as Mock).mockResolvedValueOnce(makeFakeHero('h1', 'Favorito', 1600))
    ;(db.hero.findFirst as Mock).mockResolvedValueOnce(makeFakeHero('h2', 'Underdog', 1000))
    ;(db.$transaction as Mock).mockResolvedValue([])

    const result = await runArenaDuel('h1', 'h2')
    expect(result).toHaveProperty('won')
    expect(result).toHaveProperty('eloChange')
  })
})
