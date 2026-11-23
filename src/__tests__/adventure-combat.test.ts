import { describe, expect, it } from 'vitest'
import { resolveAdventureChoice, resolveCombatStep, isAdventureBlockingNewStart, getNextEnergyRechargeAt } from '@/lib/adventures/adventure-helpers'
import { getAdventureStepGraphErrors } from '@/lib/adventures/step-graph'

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
  it('accepts forward branches that converge without crossing routes', () => {
    const steps = [
      { type: 'choice', choices: [{ nextStep: 1 }, { nextStep: 3 }] },
      { type: 'combat' },
      { type: 'choice', choices: [{ nextStep: 3 }] },
      { type: 'reward' },
    ]
    expect(getAdventureStepGraphErrors(steps)).toEqual([])
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
      heroesFinalState: [{ id: 'hero-1', hp: 0, mp: 4 }],
      levelReports: [{
        rounds: [{
          stateAfter: { enemies: [{ hp: 0 }, { hp: 12 }] },
        }],
      }],
      log: [{ message: 'The hero falls' }],
    } as never, 2, { hp: 30, mp: 8 })

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
})
