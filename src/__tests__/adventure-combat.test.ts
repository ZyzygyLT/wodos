import { describe, expect, it } from 'vitest'
import { resolveAdventureChoice, resolveCombatStep } from '@/lib/adventures/adventure-helpers'

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
