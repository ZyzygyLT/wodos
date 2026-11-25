import { describe, expect, it } from 'vitest'
import { selectDefaultAttackSkill } from '@/lib/hero-utils'

describe('selectDefaultAttackSkill', () => {
  it('prefers a magic attack for a wisdom-primary druid over a free melee attack', () => {
    const selected = selectDefaultAttackSkill([
      { id: 1, manaCost: 0, tags: ['melee'] },
      { id: 2, manaCost: 8, tags: ['magic', 'ice'] },
    ], 'wi')

    expect(selected?.id).toBe(2)
  })

  it('keeps the cheapest attack when it matches the primary attribute family', () => {
    const selected = selectDefaultAttackSkill([
      { id: 3, manaCost: 8, tags: ['melee'] },
      { id: 2, manaCost: 0, tags: ['melee'] },
      { id: 1, manaCost: 5, tags: ['magic'] },
    ], 'st')

    expect(selected?.id).toBe(2)
  })

  it('falls back to the cheapest attack when no skill matches the primary attribute', () => {
    const selected = selectDefaultAttackSkill([
      { id: 2, manaCost: 8, tags: ['magic'] },
      { id: 1, manaCost: 3, tags: ['support'] },
    ], 'st')

    expect(selected?.id).toBe(1)
  })
})
