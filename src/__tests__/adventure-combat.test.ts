import { describe, expect, it } from 'vitest'
import { resolveAdventureChoice, resolveCombatStep, isAdventureBlockingNewStart, getNextEnergyRechargeAt, isAdventureStepTerminal } from '@/lib/adventures/adventure-helpers'
import { getAdventureStepGraphErrors } from '@/lib/adventures/step-graph'
import { mergeHeroAttrs } from '@/lib/dungeon-helpers'

describe('adventure start blocking', () => {
  it('keeps active and completed adventures blocking new starts until rewards are claimed', () => {
    expect(isAdventureBlockingNewStart('active')).toBe(true)
    expect(isAdventureBlockingNewStart('completed')).toBe(true)
    expect(isAdventureBlockingNewStart('claimed')).toBe(false)
    expect(isAdventureBlockingNewStart('failed')).toBe(false)
  })
})

const hero = {
  hpMax: 100,
  mpMax: 50,
  attrs: { st: 30, dx: 20, ag: 10, pe: 10 },
  level: 5,
}

function enemy(name: string, hp: number, atk: number) {
  return { name, icon: '👾', hp, mp: 0, atk, def: 0, dx: 10, ag: 10, level: 1 }
}

describe('adventure combat resolution', () => {
  it('carries remaining HP from one enemy to the next', () => {
    const result = resolveCombatStep(hero, [
      enemy('Scout', 10, 10),
      enemy('Brute', 1000, 60),
      enemy('Guard', 10, 0),
    ])

    expect(result).toMatchObject({
      victory: false,
      enemiesDefeated: 1,
      totalEnemies: 3,
      heroHpLost: 100,
    })
    expect(result.log).toHaveLength(2)
    expect(result.log[1]).toContain('te derrota')
  })

  it('reports every enemy defeated when the hero survives the encounter', () => {
    const result = resolveCombatStep(hero, [enemy('Slime', 10, 0)])

    expect(result).toMatchObject({
      victory: true,
      enemiesDefeated: 1,
      totalEnemies: 1,
      heroHpLost: 0,
    })
  })

  it('does not report unvisited enemies as defeated after the hero falls', () => {
    const result = resolveCombatStep(
      { ...hero, hpMax: 10 },
      [enemy('Ogre', 1000, 100), enemy('Guard', 1, 0)],
    )

    expect(result.victory).toBe(false)
    expect(result.enemiesDefeated).toBe(0)
    expect(result.log).toHaveLength(1)
  })
})


describe('adventure choice resolution', () => {
  const attrs = { st: 12, dx: 8, ag: 15, pe: 10 }

  it('uses equipment bonuses when resolving attribute checks', () => {
    const effectiveAttrs = mergeHeroAttrs({
      attrs: { ...attrs, pe: 10 },
      equipStats: { pe: 4 },
    })

    const result = resolveAdventureChoice({
      text: 'Detectar una trampa', nextStep: 2,
      skillCheck: { attr: 'pe', dc: 12, passStep: 3, failStep: 4 },
    }, effectiveAttrs, 5)

    expect(result).toMatchObject({
      nextStep: 3,
      skillCheck: { attr: 'pe', dc: 12, value: 14, passed: true },
    })
  })

  it('uses the pass branch when the selected attribute meets the difficulty', () => {
    const result = resolveAdventureChoice({
      text: 'Escalar el muro', nextStep: 2,
      skillCheck: { attr: 'ag', dc: 14, passStep: 3, failStep: 4 },
    }, attrs, 5)

    expect(result).toEqual({
      nextStep: 3,
      skillCheck: { attr: 'ag', dc: 14, value: 15, passed: true },
    })
  })

  it('uses the fail branch when the selected attribute is below the difficulty', () => {
    const result = resolveAdventureChoice({
      text: 'Forzar la cerradura', nextStep: 2,
      skillCheck: { attr: 'dx', dc: 12, passStep: 3, failStep: 4 },
    }, attrs, 5)

    expect(result.nextStep).toBe(4)
    expect(result.skillCheck?.passed).toBe(false)
  })

  it('rejects a skill check that references a missing attribute', () => {
    expect(() => resolveAdventureChoice({
      text: 'Leer runas', nextStep: 2,
      skillCheck: { attr: 'wisdom', dc: 10, passStep: 3, failStep: 4 },
    }, attrs, 5)).toThrow('mal configurada')
  })
})


describe('adventure combat resource state', () => {
  const hero = { hpMax: 100, mpMax: 50, hpCurrent: 35, mpCurrent: 3, attrs: { st: 10, dx: 10, ag: 10, pe: 10 }, level: 1 }

  it('starts combat with persisted current HP and MP instead of maximum values', () => {
    const result = resolveCombatStep(hero, [{ name: 'Bandit', icon: '🗡️', hp: 1, mp: 0, atk: 10, def: 0, dx: 1, ag: 1, level: 1 }])
    expect(result.heroHpRemaining).toBeLessThan(35)
    expect(result.heroMpRemaining).toBe(2)
    expect(result.heroHpLost).toBeGreaterThan(0)
  })

  it('never consumes more MP than the hero currently has', () => {
    const result = resolveCombatStep({ ...hero, hpCurrent: 100, mpCurrent: 1 }, [
      { name: 'Warden', icon: '🛡️', hp: 1000, mp: 0, atk: 1, def: 0, dx: 1, ag: 1, level: 1 },
    ])
    expect(result.heroMpLost).toBe(1)
    expect(result.heroMpRemaining).toBe(0)
  })
})


describe('adventure step graph validation', () => {
  it('accepts valid success and failure branches for an attribute check', () => {
    const steps = [
      { type: 'choice', choices: [{ nextStep: 1, skillCheck: { passStep: 1, failStep: 2 } }] },
      { type: 'reward' },
      { type: 'combat' },
    ]
    expect(getAdventureStepGraphErrors(steps)).toEqual([])
  })

  it('rejects an invalid failure target in an attribute check', () => {
    const steps = [
      { type: 'choice', choices: [{ nextStep: 1, skillCheck: { passStep: 1, failStep: 3 } }] },
      { type: 'reward' },
      { type: 'combat' },
    ]
    expect(getAdventureStepGraphErrors(steps).some(error => error.includes('inválido'))).toBe(true)
  })
  it('accepts forward branches that converge without crossing routes', () => {
    const steps = [
      { type: 'choice', choices: [{ nextStep: 1 }, { nextStep: 3 }] },
      { type: 'combat' },
      { type: 'choice', choices: [{ nextStep: 3 }] },
      { type: 'reward' },
    ]
    expect(getAdventureStepGraphErrors(steps)).toEqual([])
  })

  it('supports a terminal branch before later branch-only encounters', () => {
    const steps = [
      { type: 'choice', choices: [{ nextStep: 1 }, { nextStep: 3 }] },
      { type: 'narrative' },
      { type: 'reward', endsAdventure: true },
      { type: 'combat' },
      { type: 'reward' },
    ]

    expect(getAdventureStepGraphErrors(steps)).toEqual([])
    expect(isAdventureStepTerminal(steps[2], 3, steps.length)).toBe(true)
    expect(isAdventureStepTerminal(steps[3], 4, steps.length)).toBe(false)
    expect(isAdventureStepTerminal(steps[4], 5, steps.length)).toBe(true)
  })

  it('rejects a choice that points back to itself', () => {
    const steps = [
      { type: 'choice', choices: [{ nextStep: 0 }] },
      { type: 'reward' },
    ]
    expect(getAdventureStepGraphErrors(steps).some(error => error.includes('ciclo'))).toBe(true)
  })

  it('rejects a cycle formed by a choice and automatic step advancement', () => {
    const steps = [
      { type: 'choice', choices: [{ nextStep: 1 }] },
      { type: 'narrative' },
      { type: 'choice', choices: [{ nextStep: 0 }] },
    ]
    expect(getAdventureStepGraphErrors(steps).some(error => error.includes('ciclo'))).toBe(true)
  })

  it('rejects choice targets outside the adventure', () => {
    const steps = [
      { type: 'choice', choices: [{ nextStep: 2 }] },
      { type: 'reward' },
    ]
    expect(getAdventureStepGraphErrors(steps).some(error => error.includes('inválido'))).toBe(true)
  })
})


it('rejects steps that cannot be reached from the adventure start', () => {
  const steps = [
    { type: 'narrative' },
    { type: 'choice', choices: [{ nextStep: 3 }] },
    { type: 'reward' },
    { type: 'narrative' },
  ]
  expect(getAdventureStepGraphErrors(steps).some(error => error.includes('inalcanzable'))).toBe(true)
})


describe('adventure combat adapter', () => {
  it('preserves adventure enemy stats and disables dungeon party scaling', async () => {
    const { createAdventureCombatDungeon } = await import('@/lib/adventures/combat-adapter')
    const dungeon = createAdventureCombatDungeon('The Gate', [
      { name: 'Gatekeeper', icon: '🛡️', hp: 90, mp: 10, atk: 18, def: 12, dx: 8, ag: 6, level: 7 },
    ])

    expect(dungeon.recommendedLevel).toBeUndefined()
    expect(dungeon.difficulty).toBeUndefined()
    expect(dungeon.levels[0].enemies[0]).toMatchObject({
      id: 1, name: 'Gatekeeper', hp: 90, atk: 18, def: 12,
      level: 7, baseLevel: 7, growthFactor: 0, position: 'front',
    })
  })

  it('maps the shared combat engine final state into an adventure result', async () => {
    const { mapAdventureCombatResult } = await import('@/lib/adventures/combat-adapter')
    const result = mapAdventureCombatResult({
      victory: false,
      totalRounds: 1,
      epGained: 0,
      goldGained: 0,
      heroesFinalState: [{ id: 'hero-1', hp: 0, mp: 4 }],
      levelReports: [{
        rounds: [{
          stateAfter: { enemies: [{ hp: 0 }, { hp: 12 }] },
        }],
      }],
      log: [{ message: 'The hero falls' }],
    } as never, 2, { hp: 30, mp: 8 })

    expect(result.replay?.levelReports).toHaveLength(1)
    expect(result.replay?.levelReports[0].rounds).toHaveLength(1)

    expect(result).toMatchObject({
      type: 'combat',
      victory: false,
      enemiesDefeated: 1,
      totalEnemies: 2,
      heroHpLost: 30,
      heroMpLost: 4,
      heroHpRemaining: 0,
      heroMpRemaining: 4,
      log: ['The hero falls'],
      replay: { victory: false, totalRounds: 1, epGained: 0, goldGained: 0 },
    })
  })
})


describe('adventure energy recharge timing', () => {
  const now = new Date('2026-11-22T12:09:00.000Z')

  it('preserves the unspent remainder of the five-minute recharge interval', () => {
    const lastRechargeAt = new Date('2026-11-22T12:00:00.000Z')

    expect(getNextEnergyRechargeAt(lastRechargeAt, 1, 4, 10, now))
      .toEqual(new Date('2026-11-22T12:05:00.000Z'))
  })

  it('resets the recharge clock when the energy cap is reached', () => {
    const lastRechargeAt = new Date('2026-11-22T12:00:00.000Z')

    expect(getNextEnergyRechargeAt(lastRechargeAt, 2, 10, 10, now)).toEqual(now)
  })

  it('carries the general adventure profile into the shared engine and its replay trace', async () => {
    const { buildHeroData } = await import('@/lib/dungeon-helpers')
    const { runDungeon } = await import('@/lib/combat-engine/dungeon-runner')
    const { createAdventureCombatDungeon, mapAdventureCombatResult } = await import('@/lib/adventures/combat-adapter')

    const generalProfile = {
      id: 'general-profile',
      dungeonLevel: null,
      position: 'rear',
      prelimRules: [],
      roundRules: [{
        priority: 1,
        condition: { type: 'always' },
        action: { skillId: 7, targetPos: 'front', targetType: 'weakest' },
      }],
      defenseSkills: {},
    }
    const persistedHero = {
      id: 'hero-adventure',
      name: 'Adventure Hero',
      level: 3,
      attrs: { st: 12, co: 12, in: 10, dx: 10, ch: 10, ag: 10, pe: 10, wi: 10 },
      hpMax: 200,
      mpMax: 40,
      hpCurrent: 200,
      mpCurrent: 40,
      gold: 0,
      combatProfiles: [generalProfile],
      skills: [{
        rank: 1,
        skill: {
          id: 7,
          type: 'basic',
          name: 'Golpe de prueba',
          icon: '⚔️',
          multiplier: 1,
          manaCost: 0,
          effect: 'attack',
          formula: { attrCoeffs: {}, skillRankCoeff: 0, diceSides: 0, diceCount: 0, flatBonus: 3 },
          tags: [],
        },
      }],
      items: [],
    }

    const combatHero = await buildHeroData(persistedHero, persistedHero.combatProfiles[0])
    expect(combatHero.combatProfile).toMatchObject({
      position: 'rear',
      roundRules: generalProfile.roundRules,
    })

    const combatRun = await runDungeon(
      [combatHero],
      createAdventureCombatDungeon('Encuentro de integración', [{
        name: 'Guardia de prueba',
        icon: '🛡️',
        hp: 500,
        mp: 0,
        atk: 0,
        def: 0,
        dx: 1,
        ag: 1,
        level: 1,
      }]),
      { random: { next: () => 0.5 } },
    )
    const mapped = mapAdventureCombatResult(combatRun, 1, { hp: 200, mp: 40 })
    const actions = mapped.replay?.levelReports[0]?.rounds.flatMap(round => round.actions) ?? []
    const heroAction = actions.find(action => action.actorId === 'hero-adventure')

    expect(heroAction).toMatchObject({
      tacticRulePriority: 1,
      tacticCondition: { type: 'always' },
      skillName: 'Golpe de prueba',
    })
    expect(mapped.replay?.levelReports).toHaveLength(1)
  })

  it('uses an adventure potion through the real combat engine only when its HP condition matches', async () => {
    const { buildHeroData } = await import('@/lib/dungeon-helpers')
    const { runDungeon } = await import('@/lib/combat-engine/dungeon-runner')
    const { createAdventureCombatDungeon, mapAdventureCombatResult } = await import('@/lib/adventures/combat-adapter')

    const profile = {
      id: 'potion-profile',
      dungeonLevel: null,
      position: 'front',
      prelimRules: [],
      roundRules: [
        {
          priority: 1,
          condition: { type: 'hp_self_lt' as const, value: 30 },
          action: { skillId: 0, itemId: 17, targetPos: 'self' as const, targetType: 'self' as const },
        },
        {
          priority: 2,
          condition: { type: 'always' as const },
          action: { skillId: 7, targetPos: 'front' as const, targetType: 'weakest' as const },
        },
      ],
      defenseSkills: {},
    }
    const persistedHero = {
      id: 'hero-potion-integration',
      name: 'Héroe de prueba',
      level: 1,
      attrs: { st: 1, co: 1, in: 1, dx: 1, ch: 1, ag: 1, pe: 1, wi: 1 },
      hpMax: 60,
      mpMax: 20,
      hpCurrent: 14,
      mpCurrent: 10,
      gold: 0,
      combatProfiles: [profile],
      skills: [{
        rank: 1,
        skill: {
          id: 7,
          type: 'basic',
          name: 'Golpe de prueba',
          icon: '⚔️',
          multiplier: 1,
          manaCost: 0,
          effect: 'attack',
          formula: { attrCoeffs: {}, skillRankCoeff: 0, diceSides: 0, diceCount: 0, flatBonus: 3 },
          tags: [],
        },
      }],
      items: [{
        id: 'earned-potion-row',
        itemId: 17,
        equipped: false,
        item: { id: 17, category: 'consumable', stats: { heal: 50 } },
      }],
    }

    const combatHero = await buildHeroData(persistedHero, profile)
    expect(combatHero.consumables).toEqual([
      { heroItemId: 'earned-potion-row', itemId: 17, healHp: 50 },
    ])

    const run = await runDungeon(
      [combatHero],
      createAdventureCombatDungeon('La Corrupción Primigenia', [{
        name: 'Corrupción Primigenia',
        icon: '👾',
        hp: 1,
        mp: 0,
        atk: 0,
        def: 0,
        dx: 1,
        ag: 1,
        level: 1,
      }]),
      { random: { next: () => 0.5 } },
    )
    const mapped = mapAdventureCombatResult(run, 1, { hp: 14, mp: 10 })
    const actions = mapped.replay?.levelReports.flatMap(level => level.rounds.flatMap(round => round.actions)) ?? []
    const potionAction = actions.find(action => action.actorId === 'hero-potion-integration' && action.itemName)

    expect(run.victory).toBe(true)
    expect(run.consumedConsumables).toEqual([
      { heroId: 'hero-potion-integration', heroItemId: 'earned-potion-row' },
    ])
    expect(potionAction).toMatchObject({
      itemName: 'item_17',
      healAmount: 46,
      healType: 'hp',
      tacticRulePriority: 1,
      tacticCondition: { type: 'hp_self_lt', value: 30 },
    })
    expect(run.heroesFinalState[0].hp).toBe(60)
    expect(mapped.replay?.levelReports).toHaveLength(1)
  })

})