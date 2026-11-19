import { describe, expect, it } from 'vitest'
import { calculateHeroStatsFromPersistedItems } from '@/engine/adapters/prisma/hero-stat-adapter'
import { asEntityId } from '@/engine/core'

describe('persisted hero stat adapter', () => {
  it('routes equipped item stats through the generic stat pipeline', () => {
    const result = calculateHeroStatsFromPersistedItems({
      heroId: asEntityId('hero-1'),
      baseStats: { strength: 10, defense: 2 },
      items: [
        { id: 'sword-row', equipped: true, item: { stats: { strength: 3 } } },
        { id: 'unused-row', equipped: false, item: { stats: { strength: 50 } } },
      ],
    })
    expect(result.values).toEqual({ strength: 13, defense: 2 })
  })
})
