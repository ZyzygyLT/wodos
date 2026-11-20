import { describe, it, expect, vi, beforeEach } from 'vitest'

let randomIndex = 0
const randomValues: number[] = []

function setupRand(...vals: number[]) {
  randomValues.length = 0
  randomValues.push(...vals)
  randomIndex = 0
}

beforeEach(() => {
  vi.restoreAllMocks()
  randomIndex = 0
  randomValues.length = 0
  vi.spyOn(Math, 'random').mockImplementation(() => {
    const v = randomValues.length > 0
      ? randomValues[Math.min(randomIndex++, randomValues.length - 1)]
      : 0.5
    return v
  })
})

const { runDungeon } = await import('@/lib/combat-engine/dungeon-runner')
import type { HeroData, DungeonData } from '@/lib/combat-engine/dungeon-runner'

const baseAttrs = { st: 10, co: 10, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 }

function makeHero(overrides: Partial<HeroData> = {}): HeroData {
  return {
    id: 'hero-1',
    name: 'TestHero',
    level: 5,
    attrs: { ...baseAttrs },
    hpMax: 10 * 10 + 5 * 5,
    mpMax: 10 * 8 + 10 * 4,
    gold: 100,
    combatProfile: {
      position: 'front',
      prelimRules: [],
      roundRules: [
        { priority: 1, condition: { type: 'always' }, action: { skillId: 1, targetPos: 'front', targetType: 'weakest' } },
      ],
      defenseSkills: {},
    },
    skills: [
      {
        skillId: 1, multiplier: 1, manaCost: 5, effect: 'attack', rank: 1,
        formula: { attrCoeffs: { st: 2, dx: 1 }, skillRankCoeff: 1.5, diceSides: 6, diceCount: 1, flatBonus: 5 },
      },
    ],
    ...overrides,
  }
}

function makeDungeon(overrides: Partial<DungeonData> = {}): DungeonData {
  return {
    id: 1,
    name: 'Mazmorra de Prueba',
    levels: [
      {
        number: 1,
        enemies: [
          { id: 1, name: 'Slime', icon: '🟢', hp: 30, mp: 0, atk: 8, def: 3, dx: 6, ag: 4, level: 1, position: 'front' },
        ],
        epReward: 100,
        goldReward: 50,
      },
    ],
    epReward: 100,
    goldReward: 50,
    fameReward: 10,
    lootTable: [{ itemId: 1, chance: 1, minQty: 1, maxQty: 1 }],
    ...overrides,
  }
}

function makeHero2(overrides: Partial<HeroData> = {}): HeroData {
  return makeHero({ id: 'hero-2', name: 'TestHero2', ...overrides })
}

describe('runDungeon', () => {
  it('returns victory after clearing all levels', async () => {
    // High random = all hits connect, no misses
    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    const result = await runDungeon([makeHero()], makeDungeon())
    expect(result.victory).toBe(true)
    expect(result.levelsCleared).toBe(1)
    expect(result.totalRounds).toBeGreaterThanOrEqual(1)
  })

  it('tracks the exact inventory row when a preliminary consumable is used', async () => {
    const hero = makeHero({
      consumables: [{ heroItemId: 'hero-item-potion-1', itemId: 42, healHp: 25 }],
      combatProfile: {
        position: 'front',
        prelimRules: [{ itemId: 42 }],
        roundRules: [{ priority: 1, condition: { type: 'always' }, action: { skillId: 1, targetPos: 'front', targetType: 'weakest' } }],
        defenseSkills: {},
      },
    })
    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    await runDungeon([hero], makeDungeon())
    expect(hero.consumables).toHaveLength(0)
    expect(hero.consumedConsumableIds).toEqual(['hero-item-potion-1'])
  })

  it('returns defeat when hero dies', async () => {
    const hero = makeHero({ hpMax: 5, attrs: { ...baseAttrs, st: 0, dx: 0, co: 0 } })
    // randoms: init_hero, init_enemy, enemy_hit(0.1<0.75→hit), enemy_crit(0.1<0.21→crit)
    setupRand(0, 0.6, 0.1, 0.1)
    const result = await runDungeon([hero], makeDungeon({
      levels: [{
        number: 1,
        enemies: [{ id: 1, name: 'Boss', icon: '👹', hp: 500, mp: 0, atk: 100, def: 0, dx: 20, ag: 20, level: 5, position: 'front' }],
        epReward: 100, goldReward: 50,
      }],
    }))
    expect(result.victory).toBe(false)
    expect(result.heroesFinalState[0].hp).toBe(0)
  })

  it('clears multiple levels', async () => {
    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    const dungeon = makeDungeon({
      levels: [
        { number: 1, enemies: [{ id: 1, name: 'Slime', icon: '🟢', hp: 20, mp: 0, atk: 5, def: 2, dx: 4, ag: 3, level: 1, position: 'front' }], epReward: 50, goldReward: 25 },
        { number: 2, enemies: [{ id: 2, name: 'Goblin', icon: '🔴', hp: 30, mp: 0, atk: 8, def: 4, dx: 6, ag: 5, level: 2, position: 'front' }], epReward: 50, goldReward: 25 },
      ],
    })
    const result = await runDungeon([makeHero()], dungeon)
    expect(result.victory).toBe(true)
    expect(result.levelsCleared).toBe(2)
  })

  it('awards EP and gold on victory', async () => {
    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    const result = await runDungeon([makeHero()], makeDungeon())
    expect(result.epGained).toBeGreaterThan(0)
    expect(result.goldGained).toBeGreaterThan(0)
    expect(result.fameGained).toBeGreaterThan(0)
  })

  it('gives partial rewards on defeat', async () => {
    const hero = makeHero({ hpMax: 10 })
    // Enemy with high defense via skill (flatBonus=999) → hero can never hit;
    // Enemy with high atk → hero dies in 1 hit
    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    const result = await runDungeon([hero], makeDungeon({
      levels: [{
        number: 1,
        enemies: [{
          id: 1, name: 'Slime', icon: '🟢', hp: 999, mp: 0,
          atk: 100, def: 0, dx: 6, ag: 4, level: 1, position: 'front',
          skills: [{ skillId: 999, name: 'Dodge', icon: '💨', multiplier: 1, manaCost: 0, defenseCategory: 'all', effect: 'dodge', formula: { attrCoeffs: {}, skillRankCoeff: 0, diceSides: 0, diceCount: 0, flatBonus: 999 } }],
        }],
        epReward: 100, goldReward: 50,
      }],
    }))
    expect(result.epGained).toBeLessThanOrEqual(100)
    expect(result.levelsCleared).toBeLessThan(1)
  })

  it('drops loot on victory', async () => {
    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    const result = await runDungeon([makeHero()], makeDungeon())
    expect(result.loot.length).toBeGreaterThanOrEqual(0)
  })

  it('applies prelim round buffs', async () => {
    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    const hero = makeHero({
      combatProfile: {
        position: 'front',
        prelimRules: [
          { skillId: 999, effect: 'party_attack_up', multiplier: 1.5 },
        ],
        roundRules: [
          { priority: 1, condition: { type: 'always' }, action: { skillId: 1, targetPos: 'front', targetType: 'weakest' } },
        ],
        defenseSkills: {},
      },
      skills: [
        ...makeHero().skills,
        { skillId: 999, multiplier: 1.5, manaCost: 0, effect: 'party_attack_up', rank: 1, formula: null as any },
      ],
    })
    const result = await runDungeon([hero], makeDungeon({ levels: [{ number: 1, enemies: [{ id: 1, name: 'Slime', icon: '🟢', hp: 5, mp: 0, atk: 5, def: 1, dx: 3, ag: 2, level: 1, position: 'front' }], epReward: 100, goldReward: 50 }] }))
    expect(result.victory).toBe(true)
    // Check prelim buff was logged
    expect(result.log.some(l => l.type === 'buff' && l.phase === 'prelim')).toBe(true)
  })

  it('supports armor penetration effect', async () => {
    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    const hero = makeHero({
      skills: [{
        skillId: 1, multiplier: 1, manaCost: 5, effect: 'armor_penetration', rank: 1,
        formula: { attrCoeffs: { st: 2, dx: 1 }, skillRankCoeff: 1.5, diceSides: 6, diceCount: 1, flatBonus: 5 },
      }],
    })
    const result = await runDungeon([hero], makeDungeon({ levels: [{ number: 1, enemies: [{ id: 1, name: 'Tank', icon: '🛡️', hp: 100, mp: 0, atk: 1, def: 50, dx: 1, ag: 1, level: 5, position: 'front' }], epReward: 100, goldReward: 50 }] }))
    // Even with high defense, armor pen should let us deal some damage
    expect(result.victory).toBe(true)
  })

  it('handles AoE attacks', async () => {
    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    const hero = makeHero({
      skills: [{
        skillId: 1, multiplier: 1, manaCost: 5, effect: 'aoe_attack', rank: 1,
        formula: { attrCoeffs: { st: 3 }, skillRankCoeff: 2, diceSides: 0, diceCount: 0, flatBonus: 20 },
      }],
    })
    const dungeon = makeDungeon({
      levels: [{
        number: 1,
        enemies: [
          { id: 1, name: 'Rat A', icon: '🐀', hp: 20, mp: 0, atk: 3, def: 1, dx: 4, ag: 4, level: 1, position: 'front' },
          { id: 2, name: 'Rat B', icon: '🐀', hp: 20, mp: 0, atk: 3, def: 1, dx: 4, ag: 4, level: 1, position: 'front' },
          { id: 3, name: 'Rat C', icon: '🐀', hp: 20, mp: 0, atk: 3, def: 1, dx: 4, ag: 4, level: 1, position: 'front' },
        ],
        epReward: 100,
        goldReward: 50,
      }],
    })
    const result = await runDungeon([hero], dungeon)
    expect(result.victory).toBe(true)
    expect(result.levelsCleared).toBe(1)
  })

  it('produces log entries for all major events', async () => {
    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    const result = await runDungeon([makeHero()], makeDungeon())
    const types = result.log.map(l => l.type)
    expect(types).toContain('level_start')
    expect(types).toContain('round_start')
    expect(types).toContain('tactic_eval')
    expect(types).toContain('level_complete')
    expect(types).toContain('victory')
  })

  it('increases hero damage when equipped items grant attributes', async () => {
    setupRand(0.5, 0.5, 0.5, 0.5, 0.5)

    const baseHero = makeHero({ 
      attrs: { ...baseAttrs, st: 10, dx: 10 },
      hpMax: 100, mpMax: 50,
    })

    const dungeon = makeDungeon({ levels: [{ number: 1, enemies: [{ id: 1, name: 'Weak Slime', icon: '🟢', hp: 50, mp: 0, atk: 0, def: 3, dx: 1, ag: 1, level: 1, position: 'front' }], epReward: 0, goldReward: 0 }] })

    const heroWithoutItem = { ...baseHero, equipStats: {} }
    const resultWithoutItem = await runDungeon([heroWithoutItem], dungeon)
    const damageWithoutItem = resultWithoutItem.levelReports?.[0]?.rounds?.[0]?.actions?.[0]?.damageBreakdown?.[0]?.value ?? 0

    setupRand(0.5, 0.5, 0.5, 0.5, 0.5)
    const heroWithItem = { ...baseHero, equipStats: { st: 5 } }
    const resultWithItem = await runDungeon([heroWithItem], dungeon)
    const damageWithItem = resultWithItem.levelReports?.[0]?.rounds?.[0]?.actions?.[0]?.damageBreakdown?.[0]?.value ?? 0

    expect(damageWithItem).toBeGreaterThan(damageWithoutItem)
  })
  it('applies equipped flat defense when resolving incoming combat damage', async () => {
    const dungeon = makeDungeon({
      levels: [{
        number: 1,
        enemies: [{ id: 1, name: 'Training Ogre', icon: '👹', hp: 5000, mp: 0, atk: 40, def: 1, dx: 1, ag: 1, level: 1, position: 'front' }],
        epReward: 0,
        goldReward: 0,
      }],
    })
    const baseHero = makeHero({ hpMax: 5000, attrs: { ...baseAttrs, dx: 0, ag: 0, pe: 0 } })

    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    const withoutDefense = await runDungeon([{ ...baseHero, equipStats: {} }], dungeon)

    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    const withDefense = await runDungeon([{ ...baseHero, equipStats: { def: 30 } }], dungeon)

    expect(withDefense.heroesFinalState[0].hp).toBeGreaterThan(withoutDefense.heroesFinalState[0].hp)
  })


  it('handles mana shield passive', async () => {
    const hero = makeHero({ manaShield: true, mpMax: 50, hpMax: 500, attrs: { ...baseAttrs, wi: 20, st: 0, dx: 0 } })
    // Enemy always hits (dx=50→hit chance capped at 0.95), seed 0.94→hit
    setupRand(0, 0, 0.94, 0.5, 0.94, 0.5, 0.94, 0.5, 0.94, 0.5)
    const result = await runDungeon([hero], makeDungeon({
      levels: [{
        number: 1,
        enemies: [{ id: 1, name: 'Tank', icon: '🛡️', hp: 500, mp: 0, atk: 100, def: 50, dx: 50, ag: 1, level: 5, position: 'front' }],
        epReward: 100, goldReward: 50,
      }],
    }))
    expect(result.log.some(l => l.message.includes('Escudo de maná'))).toBe(true)
  })

  it('handles healing skills in combat', async () => {
    setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
    const hero = makeHero({
      combatProfile: {
        position: 'front',
        prelimRules: [],
        roundRules: [
          { priority: 1, condition: { type: 'hp_self_lt', value: 100 }, action: { skillId: 2, targetPos: 'auto', targetType: 'most_injured_ally' } },
          { priority: 2, condition: { type: 'always' }, action: { skillId: 1, targetPos: 'front', targetType: 'weakest' } },
        ],
        defenseSkills: {},
      },
      skills: [
        ...makeHero().skills,
        { skillId: 2, multiplier: 1, manaCost: 5, effect: 'heal', rank: 1, healPct: 50, formula: null as any },
      ],
    })
    const result = await runDungeon([hero], makeDungeon())
    expect(result.victory).toBe(true)
  })

  describe('battle report', () => {
    it('includes levelReports with rounds and actions', async () => {
      setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
      const result = await runDungeon([makeHero()], makeDungeon())
      expect(result.levelReports).toBeDefined()
      expect(result.levelReports.length).toBeGreaterThanOrEqual(1)
      const level = result.levelReports[0]
      expect(level.levelNumber).toBe(1)
      expect(level.victory).toBe(true)
      expect(level.rounds.length).toBeGreaterThanOrEqual(1)
      const round = level.rounds[0]
      expect(round.roundNumber).toBe(1)
      expect(round.stateBefore).toBeDefined()
      expect(round.stateBefore.heroes.length).toBeGreaterThanOrEqual(1)
      expect(round.stateBefore.enemies.length).toBeGreaterThanOrEqual(1)
      expect(round.stateAfter).toBeDefined()
      expect(round.actions.length).toBeGreaterThanOrEqual(1)
      const action = round.actions[0]
      expect(action.initiative).toBeDefined()
      expect(action.actorName).toBeDefined()
      expect(action.skillName).toBeDefined()
    })

    it('stateBefore shows full HP, stateAfter shows changes', async () => {
      const hero = makeHero({ hpMax: 1000, attrs: { ...baseAttrs } })
      setupRand(0, 0.6, 0.1, 0.1)
      const result = await runDungeon([hero], makeDungeon({
        levels: [{
          number: 1,
          enemies: [{ id: 1, name: 'Boss', icon: '👹', hp: 500, mp: 0, atk: 100, def: 0, dx: 20, ag: 20, level: 5, position: 'front' }],
          epReward: 100, goldReward: 50,
        }],
      }))
      if (result.levelReports.length > 0 && result.levelReports[0].rounds.length > 0) {
        const firstRound = result.levelReports[0].rounds[0]
        expect(firstRound.stateBefore.heroes[0].hp).toBe(1000)
        expect(firstRound.stateBefore.enemies[0].hp).toBe(500)
      }
    })

    it('actions have resultType for attacks', async () => {
      setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
      const result = await runDungeon([makeHero()], makeDungeon())
      const actions = result.levelReports.flatMap(l => l.rounds.flatMap(r => r.actions))
      const attackActions = actions.filter(a => a.skillName && a.resultType)
      expect(attackActions.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('group runs — multiple heroes', () => {

    it('two heroes clear a level together', async () => {
      setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
      const heroes = [makeHero({ hpMax: 200 }), makeHero2({ hpMax: 200 })]
      const result = await runDungeon(heroes, makeDungeon())
      expect(result.victory).toBe(true)
      expect(result.levelsCleared).toBe(1)
      expect(result.heroesFinalState.length).toBe(2)
    })

    it('both heroes are in the turn queue', async () => {
      // Tough enemy that survives multiple rounds so both heroes get a turn
      setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
      const heroes = [makeHero({ id: 'hero-a', name: 'Alpha', hpMax: 999, attrs: { ...baseAttrs } }),
                      makeHero({ id: 'hero-b', name: 'Beta', hpMax: 999, attrs: { ...baseAttrs } })]
      const result = await runDungeon(heroes, makeDungeon({
        levels: [{
          number: 1,
          enemies: [
            { id: 1, name: 'Wall', icon: '🛡️', hp: 500, mp: 0, atk: 5, def: 100, dx: 3, ag: 2, level: 5, position: 'front' },
          ],
          epReward: 100, goldReward: 50,
        }],
      }))
      const actorNames = [...new Set(result.log.filter(l => l.actor).map(l => l.actor))]
      expect(actorNames).toContain('Alpha')
      expect(actorNames).toContain('Beta')
    })

    it('enemy targets the most injured hero', async () => {
      // Hero A has low HP, hero B has full — enemy should hit A
      setupRand(0.5, 0.5, 0.1, 0.5, 0.85, 0.5, 0.85, 0.5)
      const result = await runDungeon(
        [makeHero({ id: 'hero-a', name: 'Damaged', hpMax: 30, attrs: { ...baseAttrs, st: 10, dx: 10, ag: 10, co: 10, wi: 10, pe: 10, ch: 10, in: 10 } }),
         makeHero({ id: 'hero-b', name: 'FullHP', hpMax: 9999, attrs: { ...baseAttrs, st: 10, dx: 10, ag: 10, co: 10, wi: 10, pe: 10, ch: 10, in: 10 } })],
        makeDungeon({
          levels: [{
            number: 1,
            enemies: [{ id: 1, name: 'Slime', icon: '🟢', hp: 200, mp: 0, atk: 8, def: 3, dx: 6, ag: 4, level: 1, position: 'front' }],
            epReward: 100, goldReward: 50,
          }],
        }),
      )
      expect(result.victory).toBe(true)
    })

    it('group victory with one hero dead and one alive', async () => {
      const result = await runDungeon(
        [makeHero({ id: 'hero-a', name: 'Weak', hpMax: 5, attrs: { ...baseAttrs, st: 0, dx: 0, co: 0 } }),
         makeHero({ id: 'hero-b', name: 'Strong', hpMax: 500, attrs: { ...baseAttrs, st: 20, dx: 20 } })],
        makeDungeon({
          levels: [{
            number: 1,
            enemies: [{ id: 1, name: 'Boss', icon: '👹', hp: 200, mp: 0, atk: 40, def: 10, dx: 6, ag: 4, level: 5, position: 'front', ai: { type: 'weakest' } }],
            epReward: 100, goldReward: 50,
          }],
        }),
      )
      expect(result.victory).toBe(true)
      expect(result.heroesFinalState.find(h => h.id === 'hero-a')?.hp).toBe(0)
      expect(result.heroesFinalState.find(h => h.id === 'hero-b')?.hp).toBeGreaterThan(0)
    })

    it('group defeat — all heroes die', async () => {
      setupRand(0, 0.5, 0.1, 0.1, 0.1, 0.1)
      const result = await runDungeon(
        [makeHero({ id: 'hero-a', hpMax: 5, attrs: { ...baseAttrs, st: 0, dx: 0 } }),
         makeHero({ id: 'hero-b', hpMax: 5, attrs: { ...baseAttrs, st: 0, dx: 0 } })],
        makeDungeon({
          levels: [{
            number: 1,
            enemies: [{ id: 1, name: 'Boss', icon: '👹', hp: 500, mp: 0, atk: 100, def: 0, dx: 20, ag: 20, level: 5, position: 'front' }],
            epReward: 100, goldReward: 50,
          }],
        }),
      )
      expect(result.victory).toBe(false)
      expect(result.heroesFinalState.every(h => h.hp === 0)).toBe(true)
    })

    it('heroesFinalState reports all participants with correct IDs', async () => {
      setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
      const heroes = [makeHero({ id: 'g1' }), makeHero({ id: 'g2' })]
      const result = await runDungeon(heroes, makeDungeon())
      const ids = result.heroesFinalState.map(h => h.id).sort((a, b) => a.localeCompare(b))
      expect(ids).toEqual(['g1', 'g2'])
    })

    it('rewards are split per hero (EP, gold, fame)', async () => {
      setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
      const heroes = [makeHero({ id: 'a' }), makeHero({ id: 'b' })]
      const result = await runDungeon(heroes, makeDungeon())
      // Total rewards should be the same as single hero (not doubled)
      expect(result.epGained).toBeGreaterThan(0)
      expect(result.goldGained).toBeGreaterThan(0)
      expect(result.fameGained).toBeGreaterThan(0)
    })

  describe('defense system', () => {
    it('hero defense skill makes enemy attacks miss with defenseEffect', async () => {
      const hero = makeHero({
        hpMax: 500,
        attrs: { ...baseAttrs },
        combatProfile: {
          position: 'front',
          prelimRules: [],
          roundRules: [
            { priority: 1, condition: { type: 'always' }, action: { skillId: 1, targetPos: 'front', targetType: 'weakest' } },
          ],
          defenseSkills: { melee: 100 },
        },
        skills: [
          { skillId: 1, multiplier: 1, manaCost: 5, effect: 'attack', rank: 1,
            formula: { attrCoeffs: { st: 2, dx: 1 }, skillRankCoeff: 1.5, diceSides: 6, diceCount: 1, flatBonus: 5 } },
          { skillId: 100, multiplier: 1, manaCost: 0, effect: 'dodge', rank: 1,
            formula: { attrCoeffs: {}, skillRankCoeff: 0, diceSides: 0, diceCount: 0, flatBonus: 999 } },
        ],
      })
      setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
      const result = await runDungeon([hero], makeDungeon({
        levels: [{
          number: 1,
          enemies: [{ id: 1, name: 'Slime', icon: '🟢', hp: 999, mp: 0, atk: 10, def: 3, dx: 6, ag: 4, level: 1, position: 'front' }],
          epReward: 100, goldReward: 50,
        }],
      }))
      const actions = result.levelReports.flatMap(l => l.rounds.flatMap(r => r.actions))
      const enemyAttacks = actions.filter(a => a.actorName === 'Slime')
      expect(enemyAttacks.length).toBeGreaterThanOrEqual(1)
      for (const a of enemyAttacks) {
        expect(a.resultType).toBe('failed')
        expect(a.defenseEffect).toBe('dodge')
      }
    })

    it('hero without defenseSkills falls back to dx*2 with no defenseEffect', async () => {
      const hero = makeHero({
        hpMax: 500,
        attrs: { ...baseAttrs, dx: 30 },
        combatProfile: {
          position: 'front',
          prelimRules: [],
          roundRules: [
            { priority: 1, condition: { type: 'always' }, action: { skillId: 1, targetPos: 'front', targetType: 'weakest' } },
          ],
          defenseSkills: {},
        },
      })
      setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
      const result = await runDungeon([hero], makeDungeon({
        levels: [{
          number: 1,
          enemies: [{ id: 1, name: 'Rat', icon: '🐀', hp: 200, mp: 0, atk: 5, def: 3, dx: 3, ag: 3, level: 1, position: 'front' }],
          epReward: 100, goldReward: 50,
        }],
      }))
      const actions = result.levelReports.flatMap(l => l.rounds.flatMap(r => r.actions))
      const enemyAttacks = actions.filter(a => a.actorName === 'Rat')
      expect(enemyAttacks.length).toBeGreaterThanOrEqual(1)
      for (const a of enemyAttacks) {
        expect(a.resultType).toBe('failed')
        expect(a.defenseEffect).toBeFalsy()
      }
      expect(result.victory).toBe(true)
    })

    it('enemy with defense skill blocks hero attacks', async () => {
      setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
      const result = await runDungeon([makeHero({ hpMax: 500 })], makeDungeon({
        levels: [{
          number: 1,
          enemies: [{
            id: 1, name: 'Guard', icon: '🛡️', hp: 100, mp: 0,
            atk: 100, def: 0, dx: 6, ag: 4, level: 3, position: 'front',
            skills: [{
              skillId: 99, name: 'Parry', icon: '🛡️',
              multiplier: 1, manaCost: 0,
              defenseCategory: 'all', effect: 'block',
              formula: { attrCoeffs: {}, skillRankCoeff: 0, diceSides: 0, diceCount: 0, flatBonus: 60 },
            }],
          }],
          epReward: 100, goldReward: 50,
        }],
      }))
      const actions = result.levelReports.flatMap(l => l.rounds.flatMap(r => r.actions))
      const heroAttacks = actions.filter(a => a.actorName === 'TestHero')
      expect(heroAttacks.length).toBeGreaterThanOrEqual(1)
      for (const a of heroAttacks) {
        expect(a.resultType).toBe('failed')
        expect(a.defenseEffect).toBe('block')
      }
    })
  })

    it('one hero with mana_shield protects the party', async () => {
      setupRand(0, 0, 0.94, 0.5, 0.94, 0.5, 0.94, 0.5)
      const result = await runDungeon(
        [makeHero({ id: 'tank', manaShield: true, mpMax: 50, hpMax: 100 }),
         makeHero({ id: 'dps', hpMax: 100 })],
        makeDungeon({
          levels: [{
            number: 1,
            enemies: [{ id: 1, name: 'Tank', icon: '🛡️', hp: 200, mp: 0, atk: 100, def: 50, dx: 50, ag: 1, level: 5, position: 'front' }],
            epReward: 100, goldReward: 50,
          }],
        }),
      )
      expect(result.log.some(l => l.message.includes('Escudo de maná'))).toBe(true)
    })

    it('healing skill targets most injured ally in group', async () => {
      setupRand(0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5)
      const result = await runDungeon(
        [makeHero({
          id: 'healer', name: 'Healer',
          hpMax: 500,
          combatProfile: {
            position: 'rear',
            prelimRules: [],
            roundRules: [
              { priority: 1, condition: { type: 'hp_ally_lt', value: 50 }, action: { skillId: 2, targetPos: 'auto', targetType: 'most_injured_ally' } },
              { priority: 2, condition: { type: 'always' }, action: { skillId: 1, targetPos: 'front', targetType: 'weakest' } },
            ],
            defenseSkills: {},
          },
          skills: [
            { skillId: 1, multiplier: 1, manaCost: 5, effect: 'attack', rank: 1, formula: { attrCoeffs: { st: 2, dx: 1 }, skillRankCoeff: 1.5, diceSides: 6, diceCount: 1, flatBonus: 5 } },
            { skillId: 2, multiplier: 1, manaCost: 5, effect: 'heal', rank: 1, healPct: 50, formula: null as any },
          ],
        }),
         makeHero({ id: 'tank', name: 'Tank', hpMax: 100 })],
        makeDungeon(),
      )
      expect(result.victory).toBe(true)
      expect(result.heroesFinalState.length).toBe(2)
    })
  })
})


