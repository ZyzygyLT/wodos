import { describe, expect, it } from 'vitest'
import { resolveCombatStep } from '@/lib/adventures/adventure-helpers'

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
